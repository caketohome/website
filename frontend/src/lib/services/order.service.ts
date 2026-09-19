import { dbQuery, dbTransaction } from "../db";
import { OrderRepository } from "../repositories/order.repository";
import { ProductRepository } from "../repositories/product.repository";
import { BranchRepository } from "../repositories/branch.repository";
import { OfferRepository } from "../repositories/offer.repository";
import { DeliveryService } from "./delivery.service";
import { InventoryService } from "./inventory.service";
import { OrderDomain, OrderItemDomain, ProductDomain, resolveProductInventoryMode } from "../types/domain";

export interface CreateOrderParams {
  idempotency_key?: string;
  customer_id?: string;
  customer_uid?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  branch_id: string;
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
  payment_method?: "cash" | "card" | "upi" | "wallet" | "cod" | "online";
}

export class OrderService {
  /**
   * Authoritative, atomic database checkout and order creation
   */
  static async createOrder(params: CreateOrderParams): Promise<{ success: boolean; order?: OrderDomain; error?: string }> {
    const customer_name = params.customer_name || (params as any).name || "Valued Customer";
    const customer_phone = params.customer_phone || (params as any).phone || "";
    const customer_email = params.customer_email || (params as any).email;
    const branch_id = params.branch_id || (params as any).branchId || "br_indiranagar";
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
    const payment_method = (params.payment_method || (params as any).paymentMethod || "cod") as any;

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

    // 3. Validate Delivery Radius (if coordinates provided)
    let deliveryFee = 0;
    if (delivery_type !== "pickup" && typeof delivery_latitude === "number" && typeof delivery_longitude === "number") {
      const eligibility = await DeliveryService.validateDeliveryEligibility(
        { latitude: delivery_latitude, longitude: delivery_longitude },
        branch.id
      );
      if (!eligibility.eligible) {
        return { success: false, error: eligibility.message || "Delivery location exceeds maximum service radius." };
      }
      deliveryFee = eligibility.delivery_fee;
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
      if (!product) {
        return { success: false, error: `Product ${reqItem.product_id} not found in catalog.` };
      }

      let unitPrice = Number(product.price || product.selling_price || 0);
      if (unitPrice <= 0 && ((reqItem as any).unit_price || (reqItem as any).price)) {
        unitPrice = Number((reqItem as any).unit_price || (reqItem as any).price);
      }
      if (unitPrice <= 0) {
        return { success: false, error: `Product ${reqItem.product_id} has invalid or missing pricing in database.` };
      }

      // Check weight price matrix
      if (reqItem.weight && Array.isArray(product.weight_prices)) {
        const wp = (product.weight_prices as any[]).find((w: any) => w.weight_name === reqItem.weight);
        if (wp && wp.selling_price > 0) {
          unitPrice = wp.selling_price;
        }
      }

      const qty = Math.max(1, Number(reqItem.quantity || 1));
      const lineTaxRate = typeof product.gst_rate === 'number' ? product.gst_rate : (Number(product.gst_rate) || 0);
      const lineTotal = unitPrice * qty;
      const lineTax = Math.round((lineTotal * lineTaxRate) / 100);

      subtotal += lineTotal;
      totalTax += lineTax;

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
        product_name: product.title || product.name || "Cake",
        title: product.title || product.name || "Cake",
        thumbnail: product.thumbnail || "",
        variant_name: reqItem.variant_name || reqItem.weight || product.weight || "1 kg",
        weight: reqItem.weight || product.weight || "1 kg",
        quantity: qty,
        unit_price: unitPrice,
        price: unitPrice,
        selling_price: unitPrice,
        mrp: product.mrp || unitPrice,
        discount: 0,
        tax_rate: lineTaxRate,
        tax_amount: lineTax,
        customization: itemCustomization,
        total_line_amount: lineTotal,
      });
    }

    // 6. Authoritative Coupon / Discount Validation
    let discountAmount = 0;
    if (coupon_code) {
      const offer = await OfferRepository.findByCode(coupon_code);
      if (offer && offer.is_active) {
        if (subtotal >= (offer.min_order || offer.min_order_value || 0)) {
          if (offer.type === "percentage" || offer.discount_type === "percentage") {
            discountAmount = Math.round((subtotal * offer.discount_value) / 100);
            if (offer.max_discount_value && discountAmount > offer.max_discount_value) {
              discountAmount = offer.max_discount_value;
            }
          } else {
            discountAmount = offer.discount_value;
          }
        }
      }
    }

    const finalTotal = Math.max(0, subtotal - discountAmount + totalTax + deliveryFee);

    // 7. Atomic Database Transaction: Deduct Inventory, Persist Order, Record Status History
    // Generate authentic secure numeric delivery and pickup OTPs
    const deliveryOtp = String(Math.floor(100000 + Math.random() * 900000));
    const pickupOtp = String(Math.floor(100000 + Math.random() * 900000));

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const displayIdNum = parseInt(Date.now().toString().slice(-6), 10) || 1001;
    const orderNumber = `ORD-${displayIdNum}`;
    const custUid = params.customer_uid || params.customer_id || "guest";
    const email = customer_email || `${custUid}@caketohome.internal`;

    const metadata = {
      order_number: orderNumber,
      customer_uid: custUid,
      customer_name: customer_name || "Valued Customer",
      customer_phone: customer_phone || "",
      branch_id: branch.id,
      branch_name: branch.name,
      bakery_status: "confirmed",
      payment_status: payment_method === "cod" ? "pending" : "captured",
      payment_method: payment_method || "card",
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
      status: "confirmed",
      payment_status: payment_method === "cod" ? "pending" : "captured",
      payment_method: payment_method || "card",
      delivery: {
        type: delivery_type,
        date: delivery_date,
        slot: delivery_slot,
        fee: deliveryFee,
        delivery_otp: deliveryOtp,
        pickup_otp: pickupOtp,
      },
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      items: snapshottedItems,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await dbTransaction(async (client) => {
        // Step A: Authoritative Branch Kitchen Availability & Physical Inventory Validation
        for (const item of snapshottedItems) {
          const product = productMap.get(item.product_id) || (await ProductRepository.findById(item.product_id));
          if (!product) {
            throw new Error(`Product ${item.product_id} not found in catalog.`);
          }

          const mode = product.inventory_mode || resolveProductInventoryMode(product);

          if (mode === "MADE_TO_ORDER_AVAILABILITY") {
            // Validate branch kitchen fulfillment readiness for made-to-order cakes/pastries against live PostgreSQL branch record
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

            // Fresh cake/pastry: Verified against branch kitchen readiness. No synthetic inventory deduction!
          } else if (mode === "STOCK_CONTROLLED") {
            // Physical stock-controlled accessory: Atomically deduct physical inventory
            await InventoryService.deductStockAtomic(
              client,
              branch.id,
              item.product_id,
              item.quantity,
              (item as any).variant_id
            );
          } else {
            // Unknown fulfillment mode guard: fail safely rather than mutate inventory
            throw new Error(
              `Cannot process order: Fulfillment mode for item "${product.title}" (${item.product_id}) could not be authoritatively verified.`
            );
          }

          // Step A.2: CRITICAL - Deduct any physical accessory addons attached to this item
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

        // Step B: Persist order
        await client.query(
          `INSERT INTO "order" (id, display_id, email, currency_code, status, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'pending', $5, NOW(), NOW())`,
          [orderId, displayIdNum, email, "INR", JSON.stringify(metadata)]
        );

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
        const isCod = payment_method === "cod";
        await client.query(
          `INSERT INTO "payment_transaction" (
             id, company_id, branch_id, order_id, customer_id, amount, currency,
             idempotency_key, status, settlement_status, provider, provider_ref, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
          [
            paymentTxnId,
            "comp_cth_india",
            branch.id,
            orderId,
            custUid,
            Math.round(finalTotal),
            "INR",
            params.idempotency_key || `idem_${orderId}`,
            isCod ? "pending" : "captured",
            isCod ? "pending" : "settled",
            payment_method || "card",
            `ref_${orderId}`,
          ]
        );

        // Step E: Insert into PostgreSQL delivery table
        const deliveryRecordId = `del_${orderId}`;
        const formattedAddress = typeof delivery_address === "string"
          ? delivery_address
          : (delivery_address?.address_1
              ? `${delivery_address.address_1}, ${delivery_address.city || "Bengaluru"}`
              : (customer_name ? `Delivery address for ${customer_name}` : "Address on File"));
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
      });
    } catch (txErr: any) {
      return { success: false, error: txErr.message || "Failed to finalize order transaction." };
    }

    return { success: true, order: newOrder };
  }
}
