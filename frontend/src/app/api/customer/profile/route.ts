import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { retrieveUser } from "@/lib/data/users";

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

function saveStoreData(data: any): void {
  try {
    const filePath = getStoreFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[Customer Profile Route] Failed to persist data:", err);
  }
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
        { success: false, error: "Unauthorized", message: "Please log in to view your profile." },
        { status: 401 }
      );
    }

    const store = loadStoreData();
    const customers = store.customers || [];
    const normPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";

    let customer = customers.find((c: any) =>
      (customerUid && (c.customer_uid === customerUid || c.id === customerUid)) ||
      (userId && (c.id === userId || c.customer_uid === userId)) ||
      (normPhone && (c.normalized_phone === normPhone || c.phone?.replace(/\D/g, "").slice(-10) === normPhone))
    );

    // If not found in store, fall back to resolved user
    if (!customer) {
      const resolvedUser = await retrieveUser();
      if (resolvedUser) {
        customer = {
          id: resolvedUser.id || resolvedUser.customer_uid || `cus_${Date.now()}`,
          customer_uid: resolvedUser.customer_uid || resolvedUser.id || `cth_cus_${Date.now()}`,
          name: resolvedUser.name || "Valued Customer",
          full_name: resolvedUser.name || "Valued Customer",
          first_name: resolvedUser.first_name || resolvedUser.name?.split(" ")[0] || "Guest",
          last_name: resolvedUser.last_name || resolvedUser.name?.split(" ").slice(1).join(" ") || "",
          email: resolvedUser.email || "",
          phone: resolvedUser.phone || "",
          date_of_birth: resolvedUser.date_of_birth || resolvedUser.dob || null,
          addresses: [],
          orders_count: 0,
          total_spend: 0,
          created_at: resolvedUser.created_at || new Date().toISOString(),
          preferences: {
            favourite_flavour: "Belgian Dark Chocolate Truffle",
            whatsapp_notifications: true,
            sms_notifications: true,
            marketing_emails: true,
          },
        };
        store.customers = [...customers, customer];
        saveStoreData(store);
      }
    }

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Not Found", message: "Customer profile not found." },
        { status: 404 }
      );
    }

    // Calculate customer actual order metrics from orders table
    const orders = store.orders || [];
    const customerOrders = orders.filter((o: any) =>
      o.customer_id === customer.id ||
      o.customer_uid === customer.customer_uid ||
      (normPhone && (o.customer_phone?.replace(/\D/g, "").slice(-10) === normPhone || o.shipping_address?.phone?.replace(/\D/g, "").slice(-10) === normPhone))
    );

    const totalOrdersCount = customerOrders.length > 0 ? customerOrders.length : (customer.orders_count || customer.total_orders || 0);
    const totalSpentAmount = customerOrders.length > 0
      ? customerOrders.reduce((sum: number, o: any) => sum + Number(o.grand_total || o.total || o.subtotal || 0), 0)
      : (customer.total_spend || customer.total_revenue || 0);

    const profile = {
      id: customer.id,
      customer_uid: customer.customer_uid,
      name: customer.full_name || customer.name || "Valued Customer",
      full_name: customer.full_name || customer.name || "Valued Customer",
      first_name: customer.first_name || customer.name?.split(" ")[0] || "Valued",
      last_name: customer.last_name || customer.name?.split(" ").slice(1).join(" ") || "Customer",
      email: customer.email || "",
      phone: customer.phone || "",
      date_of_birth: customer.date_of_birth || null,
      preferences: {
        favourite_flavour: customer.preferences?.favourite_flavour || "Belgian Dark Chocolate Truffle",
        whatsapp_notifications: customer.preferences?.whatsapp_notifications ?? true,
        sms_notifications: customer.preferences?.sms_notifications ?? true,
        marketing_emails: customer.preferences?.marketing_emails ?? true,
      },
      stats: {
        total_orders: totalOrdersCount,
        total_spend: totalSpentAmount,
        last_order_date: customer.last_order_at || (customerOrders[0]?.created_at ?? null),
      },
      addresses: customer.addresses || [],
      created_at: customer.created_at || new Date().toISOString(),
    };

    const response = NextResponse.json(
      { success: true, data: { profile } },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve profile." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { customerUid, userId, phone, token } = getSessionUser(req);

    if (!customerUid && !userId && !phone && !token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", message: "Please log in to update your profile." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { full_name, email, date_of_birth, preferences } = body;

    // Field-level Validation
    if (full_name !== undefined) {
      if (typeof full_name !== "string" || full_name.trim().length < 2) {
        return NextResponse.json(
          { success: false, error: "Invalid Name", message: "Full name must be at least 2 characters long." },
          { status: 400 }
        );
      }
    }

    if (email !== undefined && email !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof email !== "string" || !emailRegex.test(email.trim())) {
        return NextResponse.json(
          { success: false, error: "Invalid Email", message: "Please enter a valid email address." },
          { status: 400 }
        );
      }
    }

    if (date_of_birth !== undefined && date_of_birth !== null && date_of_birth !== "") {
      const dobDate = new Date(date_of_birth);
      if (isNaN(dobDate.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid Date of Birth", message: "Please provide a valid date." },
          { status: 400 }
        );
      }
    }

    const store = loadStoreData();
    const customers = store.customers || [];
    const normPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";

    const customerIdx = customers.findIndex((c: any) =>
      (customerUid && (c.customer_uid === customerUid || c.id === customerUid)) ||
      (userId && (c.id === userId || c.customer_uid === userId)) ||
      (normPhone && (c.normalized_phone === normPhone || c.phone?.replace(/\D/g, "").slice(-10) === normPhone))
    );

    if (customerIdx < 0) {
      return NextResponse.json(
        { success: false, error: "Not Found", message: "Customer account not found for update." },
        { status: 404 }
      );
    }

    const existing = customers[customerIdx];

    // Strictly protect read-only phone number
    const updatedCustomer = {
      ...existing,
      name: full_name ? full_name.trim() : existing.name,
      full_name: full_name ? full_name.trim() : existing.full_name,
      first_name: full_name ? full_name.trim().split(" ")[0] : existing.first_name,
      last_name: full_name ? full_name.trim().split(" ").slice(1).join(" ") : existing.last_name,
      email: email !== undefined ? (email ? email.trim().toLowerCase() : "") : existing.email,
      date_of_birth: date_of_birth !== undefined ? (date_of_birth ? date_of_birth : null) : existing.date_of_birth,
      preferences: {
        ...(existing.preferences || {}),
        ...(preferences || {}),
      },
      updated_at: new Date().toISOString(),
    };

    customers[customerIdx] = updatedCustomer;
    store.customers = customers;
    saveStoreData(store);

    const profile = {
      id: updatedCustomer.id,
      customer_uid: updatedCustomer.customer_uid,
      name: updatedCustomer.full_name || updatedCustomer.name,
      full_name: updatedCustomer.full_name || updatedCustomer.name,
      first_name: updatedCustomer.first_name,
      last_name: updatedCustomer.last_name,
      email: updatedCustomer.email,
      phone: updatedCustomer.phone,
      date_of_birth: updatedCustomer.date_of_birth,
      preferences: updatedCustomer.preferences,
      stats: {
        total_orders: updatedCustomer.orders_count || updatedCustomer.total_orders || 0,
        total_spend: updatedCustomer.total_spend || updatedCustomer.total_revenue || 0,
        last_order_date: updatedCustomer.last_order_at || null,
      },
      addresses: updatedCustomer.addresses || [],
      updated_at: updatedCustomer.updated_at,
    };

    const response = NextResponse.json(
      {
        success: true,
        data: { profile },
        message: "Customer profile updated successfully.",
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update profile." },
      { status: 500 }
    );
  }
}
