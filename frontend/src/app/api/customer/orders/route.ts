import { NextRequest, NextResponse } from "next/server";
import { ApiEngine } from "@frontend/lib/api-engine";
import { dbQuery } from "@frontend/lib/db";
import { resolveVerifiedCustomer } from "@frontend/lib/security/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const verified = resolveVerifiedCustomer(req);

    if (!verified) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", message: "Please log in to view your orders." },
        { status: 401 }
      );
    }

    const { customerUid, userId, phone } = verified;
    const normPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "20", 10) || 20), 100);
    const offset = searchParams.get("offset") !== null ? Math.max(0, parseInt(searchParams.get("offset")!, 10) || 0) : (page - 1) * pageSize;

    let customerOrders: any[] = [];
    let dbTotalOrders: number | null = null;
    let dbTotalSpend: number | null = null;

    // 1. PRIMARY & AUTHORITATIVE: Direct PostgreSQL query using server-verified customer identifiers
    if (customerUid || userId || normPhone) {
      try {
        const countRes = await dbQuery(
          `SELECT COUNT(*)::int as count, COALESCE(SUM(COALESCE((metadata->>'total_amount')::numeric, (metadata->>'total')::numeric, 0)), 0)::numeric as total_spend 
           FROM "order" 
           WHERE ("customer_id" = $1 OR "metadata"->>'customer_uid' = $1 OR (length($2) >= 10 AND ("email" LIKE $2 OR "metadata"->>'customer_phone' LIKE $2))) 
             AND deleted_at IS NULL`,
          [customerUid || userId || "", normPhone ? `%${normPhone}%` : ""]
        );
        if (countRes.rows.length > 0) {
          dbTotalOrders = Number(countRes.rows[0].count || 0);
          dbTotalSpend = Number(countRes.rows[0].total_spend || 0);
        }

        const dbRes = await dbQuery(
          `SELECT * FROM "order" 
           WHERE ("customer_id" = $1 OR "metadata"->>'customer_uid' = $1 OR (length($2) >= 10 AND ("email" LIKE $2 OR "metadata"->>'customer_phone' LIKE $2))) 
             AND deleted_at IS NULL 
           ORDER BY created_at DESC, id DESC 
           LIMIT $3 OFFSET $4`,
          [customerUid || userId || "", normPhone ? `%${normPhone}%` : "", pageSize, offset]
        );
        if (dbRes.rows.length > 0) {
          customerOrders = dbRes.rows.map((row) => {
            const meta = row.metadata || {};
            return {
              id: row.id,
              display_id: row.display_id,
              order_number: meta.order_number || `ORD-${row.display_id || row.id.slice(-6)}`,
              status: meta.bakery_status || row.status,
              total: Number(meta.total_amount || row.total || 0),
              created_at: row.created_at,
              items: meta.items || [],
              delivery: meta.delivery || {},
              delivery_slot_time: meta.delivery_slot_time,
              delivery_date: meta.delivery_date,
              branch_id: meta.branch_id || row.branch_id,
            };
          });
        }
      } catch (err: any) {
        console.warn("[Customer Orders GET] Direct DB lookup warning:", err.message);
      }
    }

    // 2. In-memory store fallback strictly scoped to verified customer
    if (customerOrders.length === 0) {
      const store = ApiEngine.getStore();
      const allOrders = store.orders || [];
      const matched = allOrders.filter((o: any) => {
        const matchUid = (customerUid && (o.customer_uid === customerUid || o.customer_id === customerUid)) ||
                         (userId && (o.customer_id === userId || o.customer_uid === userId));
        const matchPhone = normPhone && (
          (o.customer_phone && o.customer_phone.replace(/\D/g, "").slice(-10) === normPhone) ||
          (o.phone && o.phone.replace(/\D/g, "").slice(-10) === normPhone) ||
          (o.shipping_address?.phone && o.shipping_address.phone.replace(/\D/g, "").slice(-10) === normPhone)
        );
        return matchUid || matchPhone;
      });

      if (matched.length > 0) {
        dbTotalOrders = matched.length;
        dbTotalSpend = matched.reduce((acc: number, cur: any) => acc + (Number(cur.total) || Number(cur.grand_total) || 0), 0);
        customerOrders = matched.slice(offset, offset + pageSize);
      }
    }

    const totalOrders = dbTotalOrders ?? 0;
    const totalSpend = dbTotalSpend ?? 0;

    const totalPages = Math.ceil(totalOrders / pageSize) || 1;
    const hasMore = offset + customerOrders.length < totalOrders;

    const response = NextResponse.json(
      {
        success: true,
        data: {
          orders: customerOrders,
          total_orders: totalOrders,
          total_spend: totalSpend,
          page,
          pageSize,
          total_pages: totalPages,
          has_more: hasMore,
          pagination: {
            page,
            pageSize,
            total: totalOrders,
            totalPages,
            hasNextPage: hasMore,
            hasPreviousPage: page > 1,
          },
        },
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("X-Data-Source", "postgres");
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve orders." },
      { status: 500 }
    );
  }
}
