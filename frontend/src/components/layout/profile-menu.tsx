"use client";

import React, { useState, useEffect, useRef } from "react";
import { Link } from "next-view-transitions";
import { authLogout } from "@frontend/lib/auth-service";
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  Store,
  Truck,
  ShoppingBag,
  MapPin,
  Clock,
  Sparkles,
  Layers,
  AlertTriangle,
  X,
  CreditCard,
} from "lucide-react";

export type AuthRole = "SUPER_ADMIN" | "BRANCH_MANAGER" | "DELIVERY_PARTNER" | "CUSTOMER";

export interface ProfileUserDTO {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  branch_name?: string;
  primary_branch_name?: string;
  shop_name?: string;
}

interface ProfileMenuProps {
  user?: ProfileUserDTO | null;
  isLoading?: boolean;
  className?: string;
  showNameOnDesktop?: boolean;
}

export function ProfileMenu({
  user = null,
  isLoading = false,
  className = "",
  showNameOnDesktop = true,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Normalize role
  const rawRole = (user?.role || "").toUpperCase();
  let normalizedRole: AuthRole = "CUSTOMER";
  if (rawRole === "SUPER_ADMIN" || rawRole === "ADMIN" || user?.id?.startsWith("admin_")) {
    normalizedRole = "SUPER_ADMIN";
  } else if (
    rawRole === "BRANCH_MANAGER" ||
    rawRole === "SHOP_MANAGER" ||
    rawRole === "SHOP" ||
    rawRole === "SHPMGR" ||
    user?.id?.startsWith("shpmgr_") ||
    user?.id?.startsWith("mgr_")
  ) {
    normalizedRole = "BRANCH_MANAGER";
  } else if (
    rawRole === "DELIVERY_PARTNER" ||
    rawRole === "DLP" ||
    user?.id?.startsWith("dlp_") ||
    user?.id?.startsWith("driver_")
  ) {
    normalizedRole = "DELIVERY_PARTNER";
  }

  // Display Name & Initials
  const fullName =
    user?.full_name ||
    user?.name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    (normalizedRole === "SUPER_ADMIN"
      ? "Super Admin"
      : normalizedRole === "BRANCH_MANAGER"
      ? "Branch Manager"
      : normalizedRole === "DELIVERY_PARTNER"
      ? "Delivery Partner"
      : "Valued Customer");

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : (fullName[0] || "U").toUpperCase();

  // Role Metadata (Colors, Badges, Icons)
  const roleConfig = {
    SUPER_ADMIN: {
      label: "Super Admin",
      badgeClass: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
      avatarBg: "bg-gradient-to-br from-purple-600 to-indigo-700 text-white ring-purple-400/40",
      icon: Shield,
      profileHref: "/dashboard?tab=settings",
      dashboardHref: "/dashboard",
      links: [
        { label: "Admin Dashboard", href: "/dashboard", icon: Layers },
        { label: "Compliance & Settings", href: "/dashboard?tab=settings", icon: Settings },
        { label: "Branch Operations", href: "/dashboard?tab=branches", icon: Store },
        { label: "Live Orders Matrix", href: "/dashboard?tab=orders", icon: ShoppingBag },
      ],
    },
    BRANCH_MANAGER: {
      label: "Branch Manager",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
      avatarBg: "bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-amber-400/40",
      icon: Store,
      profileHref: "/dashboard/shop",
      dashboardHref: "/dashboard/shop",
      links: [
        { label: "Shop Dashboard", href: "/dashboard/shop", icon: Store },
        { label: "Menu & Items", href: "/dashboard/shop/menu", icon: ShoppingBag },
        { label: "Live Branch Orders", href: "/dashboard/shop/orders", icon: Clock },
      ],
    },
    DELIVERY_PARTNER: {
      label: "Delivery Partner",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
      avatarBg: "bg-gradient-to-br from-blue-500 to-cyan-600 text-white ring-blue-400/40",
      icon: Truck,
      profileHref: "/dashboard/delivery-partner",
      dashboardHref: "/dashboard/delivery-partner",
      links: [
        { label: "Partner Portal", href: "/dashboard/delivery-partner", icon: Truck },
        { label: "Assigned Deliveries", href: "/dashboard/delivery-partner", icon: MapPin },
      ],
    },
    CUSTOMER: {
      label: "Customer",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
      avatarBg: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white ring-emerald-400/40",
      icon: User,
      profileHref: "/account",
      dashboardHref: "/account",
      links: [
        { label: "My Profile", href: "/account", icon: User },
        { label: "My Orders", href: "/account/orders", icon: ShoppingBag },
        { label: "Saved Addresses", href: "/account/addresses", icon: MapPin },
        { label: "Wallet & Credits", href: "/account/wallet", icon: CreditCard },
      ],
    },
  }[normalizedRole];

  // Click Outside & Escape Key Handlers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowConfirm(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setShowConfirm(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Central Logout Trigger with Double-Click Protection
  const handleLogoutClick = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await authLogout({ redirectUrl: "/login", reason: "user_initiated" });
    } finally {
      setIsLoggingOut(false);
      setIsOpen(false);
    }
  };

  // Loading Skeleton (Neutral — prevents flashing "Super Admin" for other users)
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 animate-pulse ${className}`}>
        <div className="w-8 h-8 rounded-full bg-neutral-700/60" />
        <div className="hidden md:flex flex-col gap-1">
          <div className="w-16 h-3 bg-neutral-700/60 rounded" />
          <div className="w-10 h-2 bg-neutral-800/60 rounded" />
        </div>
      </div>
    );
  }

  // Unauthenticated State -> Render Public Login Link
  if (!user) {
    return (
      <Link
        href="/login"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all hover:shadow-sm ${className}`}
      >
        <User className="w-4 h-4 text-amber-300" />
        <span>Login</span>
        <span className="relative flex h-2 w-2 ml-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
        </span>
      </Link>
    );
  }

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setShowConfirm(false);
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User profile and account settings menu"
        className={`flex items-center gap-2.5 p-1.5 md:px-3 md:py-1.5 rounded-xl transition-all duration-150 border ${
          isOpen
            ? "bg-white/20 border-white/30 ring-2 ring-white/20 text-white"
            : "bg-white/10 hover:bg-white/15 border-white/10 text-white/90 hover:text-white"
        }`}
      >
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner ring-2 ${roleConfig.avatarBg}`}
        >
          {initials}
        </div>

        {/* User Details (Desktop) */}
        {showNameOnDesktop && (
          <div className="hidden md:flex flex-col text-left leading-tight">
            <span className="text-xs font-bold text-white max-w-[130px] truncate">{fullName}</span>
            <span className="text-[10px] font-medium text-amber-300/90">{roleConfig.label}</span>
          </div>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-white/70 transition-transform duration-200 hidden sm:inline-block ${
            isOpen ? "rotate-180 text-white" : ""
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl border border-neutral-200/80 dark:border-neutral-800 p-2 z-[9999] animate-in fade-in zoom-in-95 duration-100 text-neutral-900 dark:text-neutral-100"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header Section with User Identity */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl mb-1 border border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ring-2 ${roleConfig.avatarBg}`}
              >
                {initials}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{fullName}</p>
                {user.email && <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>}
                {user.phone && !user.email && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user.phone}</p>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${roleConfig.badgeClass}`}
              >
                <roleConfig.icon className="w-3 h-3" />
                {roleConfig.label}
              </span>
              {(user.branch_name || user.primary_branch_name || user.shop_name) && (
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium truncate max-w-[140px]">
                  📍 {user.branch_name || user.primary_branch_name || user.shop_name}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="py-1 flex flex-col gap-0.5">
            {roleConfig.links.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                role="menuitem"
              >
                <item.icon className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

          {/* Logout Action Area */}
          <div className="p-1">
            {!showConfirm ? (
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors group"
                role="menuitem"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span>Logout</span>
                </div>
                <span className="text-[10px] text-neutral-400 group-hover:text-rose-500 font-normal">Sign out</span>
              </button>
            ) : (
              <div className="p-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl flex flex-col gap-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">Are you sure you want to logout?</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    disabled={isLoggingOut}
                    className="flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    disabled={isLoggingOut}
                    className="flex-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isLoggingOut ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Logging out...</span>
                      </>
                    ) : (
                      <>
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Logout</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
