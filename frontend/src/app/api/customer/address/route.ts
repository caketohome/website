import { NextRequest, NextResponse } from "next/server";
import { ApiEngine } from "@frontend/lib/api-engine";
import { persistCustomerAddressToDb, deleteCustomerAddressFromDb, persistCustomerToDb } from "@frontend/lib/db-persistence";
import { resolveVerifiedCustomer } from "@frontend/lib/security/auth-session";

export const dynamic = "force-dynamic";

function getSessionUser(req: NextRequest) {
  const verified = resolveVerifiedCustomer(req);
  if (!verified) {
    return { customerUid: "", userId: "", phone: "", token: "" };
  }

  return {
    customerUid: verified.customerUid,
    userId: verified.userId,
    phone: verified.phone,
    token: "",
  };
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
      return NextResponse.json({ success: true, data: { addresses: [] }, is_guest: true }, { status: 200 });
    }

    const store = ApiEngine.getStore();
    const { customer } = findCustomer(store, session);

    if (!customer) {
      return NextResponse.json({ success: true, data: { addresses: [] } }, { status: 200 });
    }

    const response = NextResponse.json(
      {
        success: true,
        data: { addresses: customer.addresses || [] },
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("X-Data-Source", "postgres");
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

    if (!address_1 || !city) {
      return NextResponse.json(
        { success: false, error: "Invalid Input", message: "Address line and city are required." },
        { status: 400 }
      );
    }

    const store = ApiEngine.getStore();
    const { customer, index } = findCustomer(store, session);

    if (!customer || index < 0) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    const existingAddresses: any[] = customer.addresses || [];
    const newAddressId = body.id || `addr_${Date.now()}`;

    if (is_default) {
      existingAddresses.forEach((a) => (a.is_default = false));
    }

    const existingIdx = existingAddresses.findIndex((a) => a.id === newAddressId);
    const parsedLat = body.latitude !== undefined ? Number(body.latitude) : body.lat !== undefined ? Number(body.lat) : undefined;
    const parsedLng = body.longitude !== undefined ? Number(body.longitude) : body.lng !== undefined ? Number(body.lng) : undefined;
    const cleanPostalCode = (postal_code || body.pincode || "").trim();

    const addressObj = {
      id: newAddressId,
      label: label || type || "Home",
      type: type || "HOME",
      name: name || customer.full_name || customer.name || "Customer",
      first_name: (name || customer.name || "Customer").split(" ")[0],
      last_name: (name || customer.name || "").split(" ").slice(1).join(" "),
      phone: phone || customer.phone || "",
      address_1: address_1.trim(),
      address_2: body.address_2 || "",
      area: body.area ? body.area.trim() : "",
      landmark: landmark ? landmark.trim() : "",
      city: city.trim(),
      state: body.state || "",
      postal_code: cleanPostalCode,
      pincode: cleanPostalCode,
      latitude: typeof parsedLat === "number" && !isNaN(parsedLat) ? parsedLat : undefined,
      longitude: typeof parsedLng === "number" && !isNaN(parsedLng) ? parsedLng : undefined,
      instructions: body.instructions ? body.instructions.trim() : "",
      is_default: is_default || existingAddresses.length === 0,
    };

    let updatedAddresses: any[];
    if (existingIdx >= 0) {
      existingAddresses[existingIdx] = addressObj;
      updatedAddresses = [...existingAddresses];
    } else {
      updatedAddresses = [...existingAddresses, addressObj];
    }

    // 1. Direct PostgreSQL Persistence (Fail Visibly on Database Error)
    await persistCustomerAddressToDb(customer.id, addressObj);

    customer.addresses = updatedAddresses;
    customer.updated_at = new Date().toISOString();
    store.customers[index] = customer;
    await persistCustomerToDb(customer);

    const response = NextResponse.json(
      {
        success: true,
        data: { addresses: updatedAddresses },
        message: "Address saved successfully.",
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("X-Data-Source", "postgres");
    return response;
  } catch (err: any) {
    console.error("[Customer Address POST Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save address to database." },
      { status: 500 }
    );
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

    const store = ApiEngine.getStore();
    const { customer, index } = findCustomer(store, session);

    if (!customer || index < 0) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    // 1. Direct PostgreSQL Deletion
    await deleteCustomerAddressFromDb(customer.id, addressId);

    const filtered = (customer.addresses || []).filter((a: any) => a.id !== addressId);
    customer.addresses = filtered;
    customer.updated_at = new Date().toISOString();
    store.customers[index] = customer;
    await persistCustomerToDb(customer);

    const response = NextResponse.json(
      {
        success: true,
        data: { addresses: filtered },
        message: "Address removed successfully.",
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("X-Data-Source", "postgres");
    return response;
  } catch (err: any) {
    console.error("[Customer Address DELETE Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete address from database." },
      { status: 500 }
    );
  }
}
