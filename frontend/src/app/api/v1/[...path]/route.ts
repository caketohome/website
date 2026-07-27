import { NextRequest, NextResponse } from "next/server";
import { ApiEngine } from "@frontend/lib/api-engine";

async function getPath(props: { params: Promise<{ path: string[] }> | { path: string[] } }): Promise<string> {
  const params = await Promise.resolve(props.params);
  if (!params || !params.path) return "";
  return Array.isArray(params.path) ? params.path.join("/") : String(params.path);
}

export async function GET(req: NextRequest, props: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  try {
    const path = await getPath(props);
    const url = new URL(req.url);

    if (path === "health") {
      return NextResponse.json(ApiEngine.getHealth());
    }

    if (path === "products") {
      const products = ApiEngine.getProducts();
      return NextResponse.json({ products, results: products });
    }

    if (path.startsWith("products/slug/")) {
      const slug = path.replace("products/slug/", "");
      const product = ApiEngine.getProductBySlug(slug);
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      return NextResponse.json(product);
    }

    if (path.startsWith("products/")) {
      const slug = path.replace("products/", "");
      const product = ApiEngine.getProductBySlug(slug);
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      return NextResponse.json(product);
    }

    if (path === "cart") {
      const cartId = url.searchParams.get("cartId") || "cart_guest_100";
      const cart = ApiEngine.getCart(cartId);
      return NextResponse.json({ cart });
    }

    if (path.startsWith("orders/")) {
      const orderId = path.replace("orders/", "");
      const order = ApiEngine.getOrder(orderId);
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      return NextResponse.json({ order });
    }

    // CMS Configurator Endpoints
    if (path === "cms/pages") {
      const pages = ApiEngine.listCmsPages();
      return NextResponse.json({ pages });
    }

    if (path.startsWith("cms/pages/")) {
      const pageId = path.replace("cms/pages/", "");
      const page = ApiEngine.getCmsPage(pageId);
      if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
      return NextResponse.json({ page });
    }

    if (path === "cms/forms") {
      const formType = url.searchParams.get("type") || undefined;
      const submissions = ApiEngine.listCmsFormSubmissions(formType);
      return NextResponse.json({ submissions });
    }

    if (path.startsWith("cms/analytics/")) {
      const pageId = path.replace("cms/analytics/", "");
      const analytics = ApiEngine.getPageAnalyticsSummary(pageId);
      return NextResponse.json({ analytics });
    }

    return NextResponse.json({ error: `API Route "${path}" not found` }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  try {
    const path = await getPath(props);
    const body = await req.json().catch(() => ({}));

    if (path === "auth/otp/request") {
      if (!body.phone) {
        return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
      }
      const res = ApiEngine.requestOtp(body.phone);
      return NextResponse.json(res);
    }

    if (path === "auth/otp/verify") {
      if (!body.phone || !body.otp) {
        return NextResponse.json({ error: "Phone and OTP are required" }, { status: 400 });
      }
      try {
        const res = ApiEngine.verifyOtp(body.phone, body.otp);
        return NextResponse.json(res);
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    if (path === "cart/items") {
      const cartId = body.cartId || "cart_guest_100";
      const cart = ApiEngine.addToCart(cartId, {
        productId: body.productId,
        variantId: body.variantId,
        quantity: body.quantity || 1,
      });
      return NextResponse.json({ cart });
    }

    if (path === "cart/promo") {
      const cartId = body.cartId || "cart_guest_100";
      try {
        const cart = ApiEngine.applyPromoCode(cartId, body.promoCode || "");
        return NextResponse.json({ cart });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    if (path === "orders") {
      try {
        const order = ApiEngine.createOrder(body);
        return NextResponse.json({ order });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    if (path === "payments/webhook") {
      return NextResponse.json({ status: "processed", received: true });
    }

    // CMS Configurator Endpoints
    if (path === "cms/pages") {
      const page = ApiEngine.createCmsPage(body);
      return NextResponse.json({ page });
    }

    if (path.startsWith("cms/pages/") && path.endsWith("/duplicate")) {
      const pageId = path.replace("cms/pages/", "").replace("/duplicate", "");
      const page = ApiEngine.duplicateCmsPage(pageId);
      return NextResponse.json({ page });
    }

    if (path.startsWith("cms/pages/") && path.endsWith("/rollback")) {
      const pageId = path.replace("cms/pages/", "").replace("/rollback", "");
      const page = ApiEngine.rollbackCmsPage(pageId, body.version || 1);
      return NextResponse.json({ page });
    }

    if (path === "cms/forms/submit") {
      const submission = ApiEngine.submitCmsForm(body.form_type || "contact", body.data || body);
      return NextResponse.json({ submission });
    }

    return NextResponse.json({ error: `API Route "${path}" not found` }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  try {
    const path = await getPath(props);
    const body = await req.json().catch(() => ({}));

    if (path.startsWith("cms/pages/")) {
      const pageId = path.replace("cms/pages/", "");
      const page = ApiEngine.updateCmsPage(pageId, body);
      return NextResponse.json({ page });
    }

    return NextResponse.json({ error: `API Route "${path}" not found` }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  try {
    const path = await getPath(props);
    const url = new URL(req.url);

    if (path.startsWith("cart/items/")) {
      const itemId = path.replace("cart/items/", "");
      const cartId = url.searchParams.get("cartId") || "cart_guest_100";
      const cart = ApiEngine.removeFromCart(cartId, itemId);
      return NextResponse.json({ cart });
    }

    if (path.startsWith("cms/pages/")) {
      const pageId = path.replace("cms/pages/", "");
      const deleted = ApiEngine.deleteCmsPage(pageId);
      return NextResponse.json({ deleted });
    }

    return NextResponse.json({ error: `API Route "${path}" not found` }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
