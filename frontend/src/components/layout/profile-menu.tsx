"use client";

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import Link from "next/link";
import { authLogout } from "@frontend/lib/auth-service";
import {
  User,
  LogOut,
  ChevronDown,
  Shield,
  Store,
  Truck,
  ShoppingBag,
  MapPin,
  Clock,
  Layers,
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

// ── Static Role Configuration (Instantiated once, never on render) ─────────────
const ROLE_CONFIGS = {
  SUPER_ADMIN: {
    label: "Super Admin",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    avatarBg: "bg-gradient-to-br from-purple-600 to-indigo-700 text-white ring-purple-400/40",
    icon: Shield,
    links: [
      { label: "Admin Dashboard", href: "/dashboard", icon: Layers },
    ],
  },
  BRANCH_MANAGER: {
    label: "Branch Manager",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    avatarBg: "bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-amber-400/40",
    icon: Store,
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
    links: [
      { label: "My Profile", href: "/account", icon: User },
      { label: "My Orders", href: "/account/orders", icon: ShoppingBag },
      { label: "Saved Addresses", href: "/account/addresses", icon: MapPin },
    ],
  },
} as const;

function getNormalizedRole(user?: ProfileUserDTO | null): AuthRole {
  if (!user) return "CUSTOMER";
  const rawRole = (user.role || "").toUpperCase();
  const userId = user.id || "";
  if (rawRole === "SUPER_ADMIN" || rawRole === "ADMIN" || userId.startsWith("admin_")) {
    return "SUPER_ADMIN";
  }
  if (
    rawRole === "BRANCH_MANAGER" ||
    rawRole === "SHOP_MANAGER" ||
    rawRole === "SHOP" ||
    rawRole === "SHPMGR" ||
    userId.startsWith("shpmgr_") ||
    userId.startsWith("mgr_")
  ) {
    return "BRANCH_MANAGER";
  }
  if (
    rawRole === "DELIVERY_PARTNER" ||
    rawRole === "DLP" ||
    userId.startsWith("dlp_") ||
    userId.startsWith("driver_")
  ) {
    return "DELIVERY_PARTNER";
  }
  return "CUSTOMER";
}

function getUserDisplayName(user: ProfileUserDTO | null, role: AuthRole): string {
  if (!user) return "";
  if (user.full_name) return user.full_name;
  if (user.name) return user.name;
  if ((user as any).customer_name) return (user as any).customer_name;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  switch (role) {
    case "SUPER_ADMIN": return "Super Admin";
    case "BRANCH_MANAGER": return "Branch Manager";
    case "DELIVERY_PARTNER": return "Delivery Partner";
    default: return user.phone || user.email || "";
  }
}

function getUserInitials(user: ProfileUserDTO | null, fullName: string): string {
  if (user?.first_name && user?.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  }
  return (fullName[0] || "U").toUpperCase();
}

import { useRouter } from "next/navigation";

export const ProfileMenu = memo(function ProfileMenu({
  user = null,
  isLoading = false,
  className = "",
  showNameOnDesktop = true,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const normalizedRole = getNormalizedRole(user);
  const roleConfig = ROLE_CONFIGS[normalizedRole];
  const fullName = getUserDisplayName(user, normalizedRole);
  const initials = getUserInitials(user, fullName);

  const toggleOpen = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setIsOpen(prev => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Programmatic, race-free router navigation handler
  const handleNavigate = useCallback((href: string, e: React.MouseEvent) => {
    // Preserve default modifier key behaviors (open in new tab, etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    closeMenu();
    router.push(href);
  }, [closeMenu, router]);

  // Robust Outside-Click, Touch & Keyboard Accessibility Handlers
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || !target.isConnected) return;

      // Ensure the interactive region (Trigger + Dropdown + Root) is recognized as one
      const isInside =
        (menuRef.current && menuRef.current.contains(target)) ||
        (dropdownRef.current && dropdownRef.current.contains(target)) ||
        (triggerRef.current && triggerRef.current.contains(target));

      if (!isInside) {
        closeMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const focusableElements = dropdownRef.current?.querySelectorAll<HTMLElement>(
          'a[role="menuitem"], button[role="menuitem"]'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const items = Array.from(focusableElements);
        const activeIndex = items.indexOf(document.activeElement as HTMLElement);

        let nextIndex = 0;
        if (event.key === "ArrowDown") {
          nextIndex = activeIndex >= items.length - 1 ? 0 : activeIndex + 1;
        } else {
          nextIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
        }
        items[nextIndex]?.focus();
      }
    };

    // Arm outside-click listeners in next tick to ensure the opening event finishes cleanly
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
    }, 0);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeMenu]);

  // Central Logout Trigger with Double-Click Protection
  const handleLogoutClick = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await authLogout({ reason: "user_initiated" });
    } finally {
      setIsLoggingOut(false);
      closeMenu();
    }
  }, [isLoggingOut, closeMenu]);

  // Loading Skeleton
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
        prefetch={false}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-navy-accent bg-navy-accent/5 hover:bg-navy-accent/10 border border-navy-accent/10 transition-all hover:shadow-sm ${className}`}
      >
        <User className="w-4 h-4 text-navy-accent/70" />
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
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="User profile and account settings menu"
        data-testid="profile-menu-trigger"
        className={`flex items-center gap-2.5 p-1.5 md:px-3 md:py-1.5 rounded-xl transition-colors duration-100 border select-none focus:outline-none focus:ring-2 focus:ring-navy-accent/20 cursor-pointer ${
          isOpen
            ? "bg-navy-accent/10 border-navy-accent/20 ring-2 ring-navy-accent/10 text-navy-accent"
            : "bg-transparent hover:bg-navy-accent/5 border-transparent text-navy-accent/90 hover:text-navy-accent"
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
            <span className="text-xs font-bold text-navy-accent max-w-[130px] truncate">{fullName}</span>
            <span className="text-[10px] font-medium text-navy-accent/70">{roleConfig.label}</span>
          </div>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-navy-accent/70 transition-transform duration-150 hidden sm:inline-block ${
            isOpen ? "rotate-180 text-navy-accent" : ""
          }`}
        />
      </button>

      {/* Dropdown Popover with pointer-events safe bridging */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 p-2 z-[9999] text-neutral-900 dark:text-neutral-100 shadow-2xl transition-all duration-100 ease-out origin-top-right transform before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3"
          style={{
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
          }}
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
          data-testid="profile-menu-dropdown"
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
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={(e) => handleNavigate(item.href, e)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800 cursor-pointer"
                role="menuitem"
                tabIndex={0}
                data-testid={`profile-menu-item-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <item.icon className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

          {/* Direct, Instant-Action Logout */}
          <div className="p-1">
            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors group focus:outline-none focus:bg-rose-50 dark:focus:bg-rose-950/40 disabled:opacity-50 cursor-pointer"
              role="menuitem"
              tabIndex={0}
              data-testid="profile-menu-logout-button"
            >
              <div className="flex items-center gap-2.5">
                {isLoggingOut ? (
                  <span className="w-4 h-4 border-2 border-rose-600 dark:border-rose-400 border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform shrink-0" />
                )}
                <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
              </div>
              <span className="text-[10px] text-neutral-400 group-hover:text-rose-500 font-normal">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
