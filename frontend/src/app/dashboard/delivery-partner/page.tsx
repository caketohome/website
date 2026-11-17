import AccountBadge from "@frontend/components/dashboard/account-badge";
import { LogoutButton } from "@frontend/components/common/logout-button";
import DeliveryColumn from "@frontend/components/dashboard/delivery-column";
import RealtimeClient from "@frontend/components/dashboard/realtime-client";
import {
  listDeliveries,
  retrieveDeliveryPartner,
  retrieveUser,
} from "@frontend/lib/data";
import { DeliveryStatus } from "@frontend/lib/types";
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui";
import { redirect } from "next/navigation";
import { Truck, ShieldCheck, MapPin, CheckCircle2, Clock, Activity, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DeliveryPartnerDashboardPage() {
  const user = await retrieveUser();

  if (!user || (user.role !== "DELIVERY_PARTNER" && user.role !== "SUPER_ADMIN" && !user.id?.includes("dlp_") && !user.id?.includes("driver_"))) {
    redirect("/login");
  }

  const dlpId = user.id;
  const delivery_partner = await retrieveDeliveryPartner(dlpId, user);
  const deliveries = await listDeliveries({
    delivery_partner_id: delivery_partner.id,
  });

  const availableCount = deliveries.filter((d) => d.delivery_status === DeliveryStatus.SHOP_ACCEPTED).length;
  const claimedCount = deliveries.filter((d) => d.delivery_status === DeliveryStatus.PICKUP_CLAIMED || d.delivery_status === DeliveryStatus.SHOP_PREPARING).length;
  const readyCount = deliveries.filter((d) => d.delivery_status === DeliveryStatus.READY_FOR_PICKUP).length;
  const transitCount = deliveries.filter((d) => d.delivery_status === DeliveryStatus.IN_TRANSIT).length;
  const completedCount = deliveries.filter((d) => d.delivery_status === DeliveryStatus.DELIVERED).length;

  const totalDel = delivery_partner.total_deliveries || completedCount;
  const slaText = totalDel > 0 ? "100%" : "N/A";
  const ratingText = typeof delivery_partner.rating === "number" ? delivery_partner.rating.toString() : "No rating yet";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* ── PROFILE & AVAILABILITY HEADER ───────────────────────────────── */}
      <div className="bg-ui-bg-base border border-ui-border-base rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Heading level="h1" className="text-xl md:text-2xl font-bold flex items-center gap-2 text-ui-fg-base">
              <Truck className="w-6 h-6 text-brand-navy" />
              {delivery_partner.full_name || `${delivery_partner.first_name} ${delivery_partner.last_name}`}
            </Heading>
            <Badge color="blue" className="font-mono text-xs px-2.5 py-0.5 rounded-md">
              {delivery_partner.partner_number}
            </Badge>
            <Badge color="green" className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {delivery_partner.availability_status || "ONLINE"}
            </Badge>
          </div>
          <p className="text-xs text-ui-fg-subtle flex items-center gap-2 flex-wrap">
            <span>📍 Primary Hub: <strong className="text-ui-fg-base">{delivery_partner.primary_branch_name}</strong></span>
            <span>•</span>
            <span>📞 {delivery_partner.phone}</span>
            <span>•</span>
            <span>⭐ Rating: <strong className="text-brand-gold">{ratingText}</strong></span>
            <span>•</span>
            <span>📦 Capacity: <strong className="text-brand-navy">{delivery_partner.current_active_orders || transitCount} / {delivery_partner.maximum_concurrent_orders || 2} Active</strong></span>
          </p>
          <RealtimeClient delivery_partnerId={delivery_partner.id} />
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full md:w-auto justify-end flex-wrap">
          <AccountBadge data={delivery_partner} type="delivery_partner" />
          <LogoutButton
            redirectUrl="/dashboard/delivery-partner/login"
            className="bg-brand-gold-soft hover:bg-brand-gold-soft text-brand-deep dark:bg-brand-deep/40 dark:text-rose-300 border border-brand-gold/30 dark:border-rose-900/50 shadow-sm"
          />
        </div>
      </div>

      {/* ── LIVE KPI METRICS SUMMARY BAR ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-ui-bg-base border border-ui-border-base rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">Available Jobs</span>
          <span className="text-xl font-bold text-brand-navy">{availableCount}</span>
        </div>
        <div className="bg-ui-bg-base border border-ui-border-base rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">Claimed Jobs</span>
          <span className="text-xl font-bold text-blue-600">{claimedCount}</span>
        </div>
        <div className="bg-ui-bg-base border border-ui-border-base rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">Ready at Kitchen</span>
          <span className="text-xl font-bold text-brand-gold">{readyCount}</span>
        </div>
        <div className="bg-ui-bg-base border border-ui-border-base rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">In Transit</span>
          <span className="text-xl font-bold text-brand-primary">{transitCount}</span>
        </div>
        <div className="bg-ui-bg-base border border-ui-border-base rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">Completed Today</span>
          <span className="text-xl font-bold text-emerald-600">{completedCount}</span>
        </div>
        <div className="bg-ui-bg-base border border-ui-border-base rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
          <span className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">On-Time SLA</span>
          <span className="text-xl font-bold text-emerald-700">{slaText}</span>
        </div>
      </div>

      {/* ── 5-COLUMN OPERATIONAL WORKSPACE ───────────────────────────────── */}
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-w-[1200px]">
          <DeliveryColumn
            title="Available jobs"
            deliveries={deliveries}
            statusFilters={[DeliveryStatus.SHOP_ACCEPTED]}
            type="delivery_partner"
            delivery_partner={delivery_partner}
          />
          <DeliveryColumn
            title="Claimed jobs"
            deliveries={deliveries}
            statusFilters={[
              DeliveryStatus.PICKUP_CLAIMED,
              DeliveryStatus.SHOP_PREPARING,
            ]}
            type="delivery_partner"
            delivery_partner={delivery_partner}
          />
          <DeliveryColumn
            title="Ready for pickup"
            deliveries={deliveries}
            statusFilters={[DeliveryStatus.READY_FOR_PICKUP]}
            type="delivery_partner"
            delivery_partner={delivery_partner}
          />
          <DeliveryColumn
            title="In transit"
            deliveries={deliveries}
            statusFilters={[DeliveryStatus.IN_TRANSIT]}
            type="delivery_partner"
            delivery_partner={delivery_partner}
          />
          <DeliveryColumn
            title="Completed"
            deliveries={deliveries}
            statusFilters={[DeliveryStatus.DELIVERED]}
            type="delivery_partner"
            delivery_partner={delivery_partner}
          />
        </div>
      </div>
    </div>
  );
}
