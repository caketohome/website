import { NextRequest, NextResponse } from "next/server";
import { ApiEngine } from "@frontend/lib/api-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accessories = ApiEngine.listAccessories();
    const categories = ApiEngine.listAccessoryCategories();
    const rules = ApiEngine.listCrossSellRules();
    return NextResponse.json({ accessories, categories, rules, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (data.type === "category") {
      const cat = ApiEngine.createAccessoryCategory(data);
      return NextResponse.json({ category: cat, success: true });
    }
    if (data.type === "rule") {
      const rule = ApiEngine.saveCrossSellRule(data);
      return NextResponse.json({ rule, success: true });
    }
    if (data.type === "mapping") {
      const mapping = ApiEngine.saveProductAccessoryMapping(data.product_id, data);
      return NextResponse.json({ mapping, success: true });
    }
    const accessory = ApiEngine.createAccessory(data);
    return NextResponse.json({ accessory, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: "Accessory ID required" }, { status: 400 });
    const updated = ApiEngine.updateAccessory(data.id, data);
    return NextResponse.json({ accessory: updated, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Accessory ID required" }, { status: 400 });
    const deleted = ApiEngine.deleteAccessory(id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
