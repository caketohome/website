import { NextRequest, NextResponse } from "next/server";
import { resolveVerifiedCustomer } from "@frontend/lib/security/auth-session";
import { dbQuery } from "@frontend/lib/db";
import { ApiEngine } from "@frontend/lib/api-engine";
import { CartRepository } from "@frontend/lib/repositories/cart.repository";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const verified = resolveVerifiedCustomer(req);
    if (!verified) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in to reorder." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id || body.orderId;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST: Missing required parameter 'order_id'." },
        { status: 400 }
      );
    }

    // 1. Fetch Order from PostgreSQL
    const orderRes = await dbQuery(
      `SELECT * FROM "order" WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND: Order does not exist." },
        { status: 404 }
      );
    }

    const order = orderRes.rows[0];

    // 2. Strict Anti-IDOR Ownership Verification
    const { customerUid, userId, phone } = verified;
    const normPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";
    const isOwner =
      (customerUid && (order.customer_id === customerUid || order.metadata?.customer_uid === customerUid)) ||
      (userId && (order.customer_id === userId || order.metadata?.user_id === userId)) ||
      (normPhone && (
        (order.customer_phone && order.customer_phone.replace(/\D/g, "").slice(-10) === normPhone) ||
        (order.email && order.email.includes(normPhone)) ||
        (order.metadata?.customer_phone && String(order.metadata.customer_phone).includes(normPhone))
      ));

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN: You do not have permission to reorder this order." },
        { status: 403 }
      );
    }

    // 3. Fetch Order Items
    const itemsRes = await dbQuery(
      `SELECT id, product_id, title, quantity, unit_price, metadata FROM public.order_item WHERE order_id = $1 ORDER BY created_at ASC`,
      [orderId]
    );

    let itemsToProcess = itemsRes.rows;
    if (itemsToProcess.length === 0 && Array.isArray(order.metadata?.items)) {
      itemsToProcess = order.metadata.items;
    }

    if (itemsToProcess.length === 0) {
      return NextResponse.json(
        { success: false, error: "EMPTY_ORDER: No items found in the original order to reorder." },
        { status: 400 }
      );
    }

    // 4. Create or Resolve Customer Cart
    const cartId = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const branchId = order.branch_id || "br_indiranagar_01";
    let addedItems: any[] = [];
    let unavailableItems: any[] = [];

    // 5. Revalidate Stock & Pricing for Each Item
    for (const item of itemsToProcess) {
      const prodId = item.product_id || item.id;
      if (!prodId) continue;

      const prodCheck = await dbQuery(
        `SELECT id, title, handle, merchandise_type, metadata, deleted_at FROM public.product WHERE id = $1 LIMIT 1`,
        [prodId]
      );

      if (prodCheck.rows.length === 0 || prodCheck.rows[0].deleted_at !== null) {
        unavailableItems.push({ product_id: prodId, title: item.title, reason: "PRODUCT_DISCONTINUED" });
        continue;
      }

      const currentProd = prodCheck.rows[0];
      const meta = currentProd.metadata || {};
      const currentPrice = Number(meta.selling_price ?? meta.price ?? item.unit_price ?? 0);

      // Stock check for physical accessories
      if (currentProd.merchandise_type === "ACCESSORY") {
        const stockRes = await dbQuery(
          `SELECT quantity, reserved FROM public.branch_inventory 
           WHERE branch_id = $1 AND (product_id = $2 OR variant_id = $2) AND deleted_at IS NULL LIMIT 1`,
          [branchId, prodId]
        );
        const avail = stockRes.rows.length > 0
          ? Math.max(0, Number(stockRes.rows[0].quantity) - Number(stockRes.rows[0].reserved))
          : 0;

        if (avail < Number(item.quantity || 1)) {
          unavailableItems.push({ product_id: prodId, title: currentProd.title, reason: "OUT_OF_STOCK" });
          continue;
        }
      }

      const cartItem = {
        cartId,
        id: `li_${cartId}_${prodId}`,
        product_id: prodId,
        productId: prodId,
        title: currentProd.title,
        name: currentProd.title,
        quantity: Math.max(1, Number(item.quantity || 1)),
        unit_price: currentPrice,
        price: currentPrice,
        subtotal: currentPrice * Math.max(1, Number(item.quantity || 1)),
        total: currentPrice * Math.max(1, Number(item.quantity || 1)),
        thumbnail: meta.thumbnail || "",
        selectedOptions: item.metadata?.selectedOptions || item.selectedOptions || {},
        cake_message: item.metadata?.cake_message || item.cake_message || "",
        metadata: {
          ...item.metadata,
          reordered_from_order: orderId,
        },
      };

      addedItems.push(cartItem);
    }

    if (addedItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ALL_ITEMS_UNAVAILABLE",
          message: "None of the items from your previous order are currently available.",
          unavailable_items: unavailableItems,
        },
        { status: 409 }
      );
    }

    // 6. Save Cart to Engine and PostgreSQL
    const cartSubtotal = addedItems.reduce((acc, it) => acc + it.subtotal, 0);
    const cartPayload = {
      id: cartId,
      shop_id: branchId,
      branch_id: branchId,
      items: addedItems,
      subtotal: cartSubtotal,
      total: cartSubtotal,
      currency_code: "inr",
      metadata: {
        reordered_from_order: orderId,
      },
    };

    ApiEngine.saveCart(cartPayload);
    try {
      await CartRepository.saveCart({
        id: cartId,
        currency_code: "inr",
        metadata: { shop_id: branchId, subtotal: cartSubtotal, total: cartSubtotal },
      });
      for (const it of addedItems) {
        await CartRepository.upsertLineItem(cartId, it);
      }
    } catch (dbErr: any) {
      console.warn("[Reorder Cart DB Warning]:", dbErr.message);
    }

    const response = NextResponse.json({
      success: true,
      data: {
        cart_id: cartId,
        cart: cartPayload,
        added_count: addedItems.length,
        added_items: addedItems,
        unavailable_items: unavailableItems,
      },
      message: `Successfully created cart with ${addedItems.length} reordered item(s).`,
    });

    response.cookies.set("_cth_cart_id", cartId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    response.cookies.set("_medusa_cart_id", cartId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (err: any) {
    console.error("[Order Reorder Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process reorder." },
      { status: 500 }
    );
  }
}
