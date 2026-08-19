import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function getStoreFilePath(): string {
  let root = process.cwd();
  if (!root.endsWith("frontend") && fs.existsSync(path.join(root, "frontend"))) {
    root = path.join(root, "frontend");
  }
  const dir = path.join(root, "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "db-store.json");
}

function loadStoreData(): any {
  const filePath = getStoreFilePath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return { customers: [], orders: [] };
    }
  }
  return { customers: [], orders: [] };
}

function getSessionUser(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const authHeader = req.headers.get("authorization") || "";

  const cookiesObj: Record<string, string> = {};
  cookieHeader.split(";").forEach((c) => {
    const [k, ...v] = c.trim().split("=");
    if (k) cookiesObj[k] = decodeURIComponent(v.join("="));
  });

  const customerUid = req.cookies.get("_cth_customer_uid")?.value || cookiesObj["_cth_customer_uid"] || req.headers.get("x-customer-uid") || "";
  const userId = req.cookies.get("_cth_user_id")?.value || cookiesObj["_cth_user_id"] || req.headers.get("x-user-id") || "";
  const phone = req.cookies.get("_cth_phone")?.value || cookiesObj["_cth_phone"] || req.headers.get("x-phone") || "";
  const token = req.cookies.get("_cth_jwt")?.value || cookiesObj["_cth_jwt"] || authHeader.replace(/^Bearer\s+/i, "");

  return { customerUid, userId, phone, token };
}

export async function GET(req: NextRequest) {
  try {
    const { customerUid, userId, phone, token } = getSessionUser(req);

    if (!customerUid && !userId && !phone && !token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", message: "Please log in to view your orders." },
        { status: 401 }
      );
    }

    const store = loadStoreData();
    const orders = store.orders || [];
    const normPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";

    const customerOrders = orders.filter((o: any) => {
      const orderPhone = (o.customer_phone || o.phone || o.shipping_address?.phone || "").replace(/\D/g, "").slice(-10);
      const matchUid = customerUid && (o.customer_uid === customerUid || o.customer_id === customerUid);
      const matchUserId = userId && (o.customer_id === userId || o.user_id === userId);
      const matchPhone = normPhone && orderPhone === normPhone;
      return matchUid || matchUserId || matchPhone;
    });

    // Sort newest first
    customerOrders.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    const totalOrders = customerOrders.length;
    const totalSpend = customerOrders.reduce((sum: number, o: any) => sum + Number(o.grand_total || o.total || o.subtotal || 0), 0);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          orders: customerOrders,
          total_orders: totalOrders,
          total_spend: totalSpend,
        },
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve orders." },
      { status: 500 }
    );
  }
}
