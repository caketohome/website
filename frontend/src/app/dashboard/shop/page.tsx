import AccountBadge from "@frontend/components/dashboard/account-badge";
import DeliveryColumn from "@frontend/components/dashboard/delivery-column";
import RealtimeClient from "@frontend/components/dashboard/realtime-client";
import ShopStatus from "@frontend/components/dashboard/shop/shop-status";
import { retrieveShop, retrieveUser } from "@frontend/lib/data";
import { DeliveryStatus, ShopManagerDTO } from "@frontend/lib/types";
import { Container, Heading, StatusBadge, Text } from "@medusajs/ui";
import { Link } from "next-view-transitions";
import { notFound, redirect } from "next/navigation";

export default async function ShopDashboardPage() {
  const user = (await retrieveUser()) as ShopManagerDTO;

  if (!user || (!user.id.includes("shpmgr_") && !user.id.includes("admin_"))) {
    redirect("/login");
  }

  const shopId = user.shop_id || "shop_01";
  const shop = await retrieveShop(shopId);
  const { name, deliveries, is_open } = shop;

  return (
    <>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <Heading level="h1" className="text-2xl">
            {name} | Shop Dashboard
          </Heading>
          <Text>View and manage your shop&apos;s orders.</Text>
        </div>
        <Container className="grid grid-cols-1 md:grid-cols-3 p-6 md:p-8 gap-4">
          <div className="flex flex-col justify-between gap-2">
            <Text className="font-semibold">Shop Status</Text>
            <div className="flex gap-2">
              <Text>Shop status: </Text>{" "}
              <StatusBadge
                color={is_open ? "green" : "red"}
                className="flex pl-1 pr-2 py-1 gap-1 w-fit"
              >
                {is_open ? "Taking orders" : "Closed"}
              </StatusBadge>
              <ShopStatus shop={shop} />
            </div>
            <div className="flex gap-2">
              <Text>Connection status: </Text>{" "}
              <RealtimeClient shopId={shopId} />
            </div>
          </div>
          <div className="flex flex-col justify-between">
            <Text className="font-semibold text-sm">Branch Availability Matrix</Text>
            <div className="flex flex-col gap-1 text-xs mt-1">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">🟢 Available: Normal Catalog Purchase</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">🟡 Out of Stock: Card Badge Displayed</span>
              <span className="font-medium text-rose-600 dark:text-rose-400">🔴 Hidden: Omitted from Branch Catalog</span>
            </div>
            <Link
              href="/dashboard/shop/menu"
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover text-xs font-semibold mt-2 underline"
            >
              Manage 3-State Availability Controls →
            </Link>
          </div>
          <div className="flex md:justify-end">
            <AccountBadge data={shop} type="shop" />
          </div>
        </Container>
      </div>

      <div className="overflow-x-auto whitespace-nowrap">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-px">
          <DeliveryColumn
            title="Incoming orders"
            deliveries={deliveries}
            statusFilters={[
              DeliveryStatus.PENDING,
              DeliveryStatus.SHOP_ACCEPTED,
            ]}
            type="shop"
          />
          <DeliveryColumn
            title="Ready to prepare"
            deliveries={deliveries}
            statusFilters={[DeliveryStatus.PICKUP_CLAIMED]}
            type="shop"
          />
          <DeliveryColumn
            title="Preparing"
            deliveries={deliveries}
            statusFilters={[DeliveryStatus.SHOP_PREPARING]}
            type="shop"
          />
          <DeliveryColumn
            title="In transit"
            deliveries={deliveries}
            statusFilters={[
              DeliveryStatus.READY_FOR_PICKUP,
              DeliveryStatus.IN_TRANSIT,
            ]}
            type="shop"
          />
          <DeliveryColumn
            title="Completed"
            deliveries={deliveries}
            statusFilters={[
              DeliveryStatus.DELIVERED,
              DeliveryStatus.SHOP_DECLINED,
            ]}
            type="shop"
          />
        </div>
      </div>
    </>
  );
}
