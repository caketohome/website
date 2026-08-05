"use client";

import { DeliveryPartnerDTO, ShopManagerDTO } from "@frontend/lib/types";
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
    <div className="relative group flex items-center">
      <Link
        href={dashboardPath}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white"
      >
        {user ? (
          <>
            <span className="text-sm font-bold text-white hidden md:inline-block leading-none">
              {`${user.first_name} ${user.last_name}`}
            </span>
            <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/30 hover:ring-white shadow-md flex items-center justify-center bg-white/10 shrink-0">
              {user.first_name ? (
                <img
                  src={`https://robohash.org/${user.id}?size=40x40&set=set1&bgset=bg1`}
                  alt={`${user.first_name} ${user.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-white">
                  {(user.first_name?.[0] || "U") + (user.last_name?.[0] || "")}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="text-sm font-bold text-white leading-none">
              Login
            </span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4D6D] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF4D6D]"></span>
            </span>
          </>
        )}
      </Link>

      {user && (
        <div className="hidden group-hover:block absolute top-full mt-2 right-0 z-50 p-2 bg-white text-slate-900 border border-gray-100 shadow-xl rounded-xl w-48">
          <LogoutButton variant="transparent" size="small" fullWidth />
        </div>
      )}
    </div>
  );
}
