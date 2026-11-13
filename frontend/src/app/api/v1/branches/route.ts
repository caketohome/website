import { NextRequest, NextResponse } from "next/server";
import { ApiEngine } from "@frontend/lib/api-engine";
import { BranchRepository } from "@frontend/lib/repositories";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const actionType = searchParams.get("type");

    if (actionType === "slots") {
      const branchId = searchParams.get("branchId") || searchParams.get("branch_id") || "";
      const date = searchParams.get("date") || "";
      const mode = (searchParams.get("mode") as any) || "delivery";
      const slots = ApiEngine.getDeliverySlots(branchId, date, mode);
      return NextResponse.json({ ...slots, success: true });
    }

    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const pincode = searchParams.get("pincode") || undefined;
    const areaName = searchParams.get("area") || undefined;
    const isExpress = searchParams.get("express") === "true";
    const isMidnight = false; // Midnight delivery discontinued
    const orderTotal = searchParams.get("orderTotal") ? parseFloat(searchParams.get("orderTotal")!) : undefined;

    if (latStr || lngStr || pincode || areaName) {
      const lat = latStr ? parseFloat(latStr) : undefined;
      const lng = lngStr ? parseFloat(lngStr) : undefined;
      const resolved = ApiEngine.resolveSmartBranch({ lat, lng, pincode, areaName, isExpress, isMidnight: false, orderTotal });
      if (resolved?.branch?.fulfillment_rules) {
        (resolved.branch.fulfillment_rules as any).midnight_enabled = false;
      }
      if (resolved?.zone) {
        (resolved.zone as any).midnight_allowed = false;
        (resolved.zone as any).midnight_charge = 0;
      }
      return NextResponse.json({ ...resolved, success: true });
    }

    const search = searchParams.get("search") || searchParams.get("q") || undefined;
    const lifecycle = (searchParams.get("lifecycle") as any) || "all";
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

    const result = await BranchRepository.findWithFilters({
      search,
      lifecycle,
      page,
      limit,
    });
    const cityAreas = ApiEngine.listCityAreasPincodes();
    return NextResponse.json({
      branches: result.branches,
      total: result.total,
      totalCount: result.totalCount,
      activeCount: result.activeCount,
      archivedCount: result.archivedCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      cityAreas,
      success: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch branches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { type } = body;

    if (type === "validate_order") {
      const validation = ApiEngine.validateOrderEligibility({
        pincode: body.pincode,
        product_ids: body.product_ids,
        accessory_ids: body.accessory_ids,
        delivery_type: body.delivery_type,
        scheduled_date: body.scheduled_date,
        order_total: body.order_total,
      });
      return NextResponse.json({ ...validation, success: true });
    }

    if (type === "update_area_status") {
      const updatedArea = ApiEngine.updateCityAreaStatus(body.areaId, body.status, body.reason, body.blockedUntil);
      if (!updatedArea) {
        return NextResponse.json({ error: "Area not found" }, { status: 404 });
      }
      return NextResponse.json({ area: updatedArea, success: true });
    }

    return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Action failed" }, { status: 500 });
  }
}
