import { dbQuery, dbTransaction } from "../db";
import { OrderDomain, OrderItemDomain } from "../types/domain";

export class OrderRepository {
  /**
   * Find all orders from PostgreSQL
   */
  static async findAll(limit: number = 500): Promise<OrderDomain[]> {
    const res = await dbQuery(
      `SELECT * FROM "order" WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );

    return (res.rows || []).map((o: any) => {
      const meta = o.metadata || {};
      return {
        id: o.id,
        order_id: o.id,
        display_id: o.display_id || o.id,
        order_number: meta.order_number || o.display_id || `ORD-${o.id.slice(-6)}`,
        customer_id: meta.customer_uid || o.email || "guest",
        customer_uid: meta.customer_uid || "guest",
        customer_name: meta.customer_name || "Valued Customer",
        customer_email: o.email || "",
        customer_phone: meta.customer_phone || "",
        branch_id: o.branch_id || meta.branch_id || "br_indiranagar",
        branch_name: meta.branch_name || "Indiranagar Flagship Bakery",
        total_amount: Number(o.total || 0),
        total: Number(o.total || 0),
        subtotal: Number(meta.subtotal || o.total || 0),
        discount_amount: Number(meta.discount_amount || 0),
        tax_amount: Number(meta.tax_amount || 0),
        delivery_fee: Number(meta.delivery?.fee || 0),
        currency: o.currency_code || "INR",
        status: meta.bakery_status || o.status || "confirmed",
        payment_status: meta.payment_status || "captured",
        payment_method: meta.payment_method || "card",
        delivery: meta.delivery || {
          type: "standard",
          date: meta.delivery_date || new Date().toISOString().split("T")[0],
          slot: meta.delivery_slot_time || "18:00 - 20:00",
          fee: 0,
        },
        delivery_address: meta.delivery_address || undefined,
        delivery_latitude: typeof o.delivery_latitude === "number" ? o.delivery_latitude : meta.delivery_latitude,
        delivery_longitude: typeof o.delivery_longitude === "number" ? o.delivery_longitude : meta.delivery_longitude,
        delivery_partner_id: meta.delivery_partner_id || null,
        delivery_partner_name: meta.delivery_partner_name || null,
        items: meta.items || [],
        created_at: o.created_at,
        updated_at: o.updated_at,
      };
    });
  }

  /**
   * Find order by ID or order_number
   */
  static async findById(idOrNumber: string): Promise<OrderDomain | null> {
    const res = await dbQuery(
      `SELECT * FROM "order" WHERE (id = $1 OR display_id = $1 OR metadata->>'order_number' = $1) AND deleted_at IS NULL LIMIT 1`,
      [idOrNumber]
    );
    if (!res.rows || res.rows.length === 0) return null;
    const o = res.rows[0];
    const meta = o.metadata || {};
    return {
      id: o.id,
      order_id: o.id,
      display_id: o.display_id || o.id,
      order_number: meta.order_number || o.display_id || `ORD-${o.id.slice(-6)}`,
      customer_id: meta.customer_uid || o.email || "guest",
      customer_uid: meta.customer_uid || "guest",
      customer_name: meta.customer_name || "Valued Customer",
      customer_email: o.email || "",
      customer_phone: meta.customer_phone || "",
      branch_id: o.branch_id || meta.branch_id || "br_indiranagar",
      branch_name: meta.branch_name || "Indiranagar Flagship Bakery",
      total_amount: Number(o.total || 0),
      total: Number(o.total || 0),
      subtotal: Number(meta.subtotal || o.total || 0),
      discount_amount: Number(meta.discount_amount || 0),
      tax_amount: Number(meta.tax_amount || 0),
      delivery_fee: Number(meta.delivery?.fee || 0),
      currency: o.currency_code || "INR",
      status: meta.bakery_status || o.status || "confirmed",
      payment_status: meta.payment_status || "captured",
      payment_method: meta.payment_method || "card",
      delivery: meta.delivery || {
        type: "standard",
        date: meta.delivery_date || new Date().toISOString().split("T")[0],
        slot: meta.delivery_slot_time || "18:00 - 20:00",
        fee: 0,
      },
      delivery_address: meta.delivery_address || undefined,
      delivery_latitude: typeof o.delivery_latitude === "number" ? o.delivery_latitude : meta.delivery_latitude,
      delivery_longitude: typeof o.delivery_longitude === "number" ? o.delivery_longitude : meta.delivery_longitude,
      delivery_partner_id: meta.delivery_partner_id || null,
      delivery_partner_name: meta.delivery_partner_name || null,
      items: meta.items || [],
      created_at: o.created_at,
      updated_at: o.updated_at,
    };
  }

  /**
   * Save order with historical price snapshot transactionally in PostgreSQL
   */
  static async save(order: OrderDomain): Promise<void> {
    const id = order.id || order.order_id || `order_${Date.now()}`;
    const displayId = order.display_id || order.order_number || `ORD-${id.slice(-6)}`;
    const email = order.customer_email || `${order.customer_uid || "guest"}@caketohome.internal`;
    const currency = order.currency || "INR";
    const total = Number(order.total_amount || order.total || 0);
    const status = order.status || "confirmed";

    // Build immutable historical items snapshot
    const snapshottedItems: OrderItemDomain[] = (order.items || []).map((item) => ({
      id: item.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      item_id: item.item_id || item.id,
      product_id: item.product_id,
      product_name: item.product_name || item.title || "Custom Cake",
      title: item.product_name || item.title || "Custom Cake",
      thumbnail: item.thumbnail || "",
      variant_name: item.variant_name || item.weight || "1 kg",
      weight: item.weight || item.variant_name || "1 kg",
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || item.price || item.selling_price || 0),
      price: Number(item.unit_price || item.price || item.selling_price || 0),
      selling_price: Number(item.unit_price || item.price || item.selling_price || 0),
      mrp: Number(item.mrp || item.unit_price || 0),
      discount: Number(item.discount || 0),
      tax_rate: Number(item.tax_rate || 5),
      tax_amount: Number(item.tax_amount || 0),
      customization: item.customization || {},
      total_line_amount: Number(item.total_line_amount || (Number(item.quantity || 1) * Number(item.unit_price || item.price || 0))),
    }));

    const metadata = {
      order_number: displayId,
      customer_uid: order.customer_uid || order.customer_id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      branch_id: order.branch_id,
      branch_name: order.branch_name,
      bakery_status: status,
      payment_status: order.payment_status || "captured",
      payment_method: order.payment_method || "card",
      subtotal: order.subtotal || total,
      discount_amount: order.discount_amount || 0,
      tax_amount: order.tax_amount || 0,
      delivery: order.delivery || {
        type: "standard",
        date: new Date().toISOString().split("T")[0],
        slot: "18:00 - 20:00",
        fee: 0,
      },
      delivery_date: order.delivery?.date,
      delivery_slot_time: order.delivery?.slot,
      delivery_address: order.delivery_address,
      delivery_latitude: order.delivery_latitude,
      delivery_longitude: order.delivery_longitude,
      delivery_partner_id: order.delivery_partner_id || null,
      delivery_partner_name: order.delivery_partner_name || null,
      items: snapshottedItems,
    };

    await dbQuery(
      `
      INSERT INTO "order" (id, display_id, email, currency_code, total, status, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        display_id = EXCLUDED.display_id,
        email = EXCLUDED.email,
        total = EXCLUDED.total,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
      [id, displayId, email, currency, total, status, JSON.stringify(metadata)]
    );
  }

  /**
   * Update order status directly in PostgreSQL
   */
  static async updateStatus(orderId: string, status: string, notes?: string): Promise<void> {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    order.status = status as any;
    await OrderRepository.save(order);
  }
}
