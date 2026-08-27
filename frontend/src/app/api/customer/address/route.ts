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
      return { customers: [] };
    }
  }
  return { customers: [] };
}

function saveStoreData(data: any): void {
  try {
    const filePath = getStoreFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[Customer Address Route] Failed to persist data:", err);
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

function findCustomer(store: any, session: any) {
  const customers = store.customers || [];
  const { customerUid, userId, phone } = session;
  const normPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";

  const index = customers.findIndex((c: any) =>
    (customerUid && (c.customer_uid === customerUid || c.id === customerUid)) ||
    (userId && (c.id === userId || c.customer_uid === userId)) ||
    (normPhone && (c.normalized_phone === normPhone || c.phone?.replace(/\D/g, "").slice(-10) === normPhone))
  );

  return { customer: index >= 0 ? customers[index] : null, index };
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session.customerUid && !session.userId && !session.phone && !session.token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const store = loadStoreData();
    const { customer } = findCustomer(store, session);

    if (!customer) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    const response = NextResponse.json(
      {
        success: true,
        data: { addresses: customer.addresses || [] },
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session.customerUid && !session.userId && !session.phone && !session.token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { address_1, city, postal_code, landmark, type, is_default, label, name, phone } = body;

    if (!address_1 || !city || !postal_code) {
      return NextResponse.json(
        { success: false, error: "Invalid Input", message: "Address line, city, and pincode are required." },
        { status: 400 }
      );
    }

    const store = loadStoreData();
    const { customer, index } = findCustomer(store, session);

    if (!customer || index < 0) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    const existingAddresses: any[] = customer.addresses || [];
    const newAddressId = body.id || `addr_${Date.now()}`;

    let updatedAddresses: any[];
    if (is_default) {
      existingAddresses.forEach((a) => (a.is_default = false));
    }

    const existingIdx = existingAddresses.findIndex((a) => a.id === newAddressId);
    const parsedLat = body.latitude !== undefined ? Number(body.latitude) : body.lat !== undefined ? Number(body.lat) : undefined;
    const parsedLng = body.longitude !== undefined ? Number(body.longitude) : body.lng !== undefined ? Number(body.lng) : undefined;

    const addressObj = {
      id: newAddressId,
      label: label || type || "Home",
      type: type || "HOME",
      name: name || customer.full_name || customer.name || "Customer",
      phone: phone || customer.phone || "",
      address_1: address_1.trim(),
      address_2: body.address_2 || "",
      area: body.area ? body.area.trim() : "",
      landmark: landmark ? landmark.trim() : "",
      city: city.trim(),
      state: body.state || "",
      postal_code: postal_code.trim(),
      latitude: typeof parsedLat === "number" && !isNaN(parsedLat) ? parsedLat : undefined,
      longitude: typeof parsedLng === "number" && !isNaN(parsedLng) ? parsedLng : undefined,
      instructions: body.instructions ? body.instructions.trim() : "",
      is_default: is_default || existingAddresses.length === 0,
    };

    if (existingIdx >= 0) {
      existingAddresses[existingIdx] = addressObj;
      updatedAddresses = [...existingAddresses];
    } else {
      updatedAddresses = [...existingAddresses, addressObj];
    }

    customer.addresses = updatedAddresses;
    customer.updated_at = new Date().toISOString();
    store.customers[index] = customer;
    saveStoreData(store);

    const response = NextResponse.json(
      {
        success: true,
        data: { addresses: updatedAddresses },
        message: "Address saved successfully.",
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session.customerUid && !session.userId && !session.phone && !session.token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const addressId = url.searchParams.get("id");

    if (!addressId) {
      return NextResponse.json({ success: false, error: "Address ID is required" }, { status: 400 });
    }

    const store = loadStoreData();
    const { customer, index } = findCustomer(store, session);

    if (!customer || index < 0) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    const filtered = (customer.addresses || []).filter((a: any) => a.id !== addressId);
    customer.addresses = filtered;
    customer.updated_at = new Date().toISOString();
    store.customers[index] = customer;
    saveStoreData(store);

    const response = NextResponse.json(
      {
        success: true,
        data: { addresses: filtered },
        message: "Address removed successfully.",
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
