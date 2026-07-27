"use client";

import { DeliveryPartnerDTO, ShopManagerDTO } from "@frontend/lib/types";
import { Avatar, Button, Text } from "@medusajs/ui";
import { Link } from "next-view-transitions";
import { LogoutButton } from "./logout-button";

type ProfileBadgeProps = {
  user: ShopManagerDTO | DeliveryPartnerDTO | null;
};

export function ProfileBadge({ user }: ProfileBadgeProps) {
  const getDashboardPath = () => {
    if (!user) return "/login";
    const userRole = (user as any)?.role?.toUpperCase();
    if (userRole === "SUPER_ADMIN" || user.id?.startsWith("admin_")) return "/dashboard";
    if (userRole === "SHOP_MANAGER" || user.id?.startsWith("shpmgr_")) return "/dashboard/shop";
    if (userRole === "DELIVERY_PARTNER" || user.id?.startsWith("dlp_")) return "/dashboard/delivery-partner";
    return "/account";
  };
  const dashboardPath = getDashboardPath();

  return (
    <div className="flex flex-col relative group w-fit">
      <Link href={dashboardPath} className="flex gap-2 items-center">
        <Button
          size="large"
          variant="transparent"
          className="group group-hover:bg-ui-bg-subtle-hover transition-none"
        >
          {user ? (
            <>
              <Text className="text-sm text-ui-bg-base group-hover:text-ui-fg-base hidden md:block">
                {`${user.first_name} ${user.last_name}`}
              </Text>
              <Avatar
                src={`https://robohash.org/${user.id}?size=40x40&set=set1&bgset=bg1`}
                fallback={user.first_name[0] + user.last_name[0]}
                className="bg-ui-bg-base cursor-pointer"
              />
            </>
          ) : (
            <>
              <Text className="text-sm text-ui-bg-base group-hover:text-ui-fg-base">
                Login
              </Text>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ui-bg-interactive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-ui-bg-interactive"></span>
              </span>
            </>
          )}
        </Button>
      </Link>
      {user && (
        <div className="hidden group-hover:block absolute top-10 right-0 z-50 p-2 bg-white dark:bg-slate-900 border shadow-lg rounded-xl min-w-40">
          <LogoutButton variant="transparent" size="small" fullWidth />
        </div>
      )}
    </div>
  );
}
