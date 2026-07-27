"use client";

import { useState } from "react";
import { logout } from "@frontend/lib/actions/users";
import { Button } from "@medusajs/ui";
import { LogOut } from "lucide-react";

interface LogoutButtonProps {
  className?: string;
  variant?: "primary" | "secondary" | "transparent" | "danger";
  size?: "small" | "base" | "large";
  fullWidth?: boolean;
}

export function LogoutButton({
  className = "",
  variant = "secondary",
  size = "base",
  fullWidth = false,
}: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Clear client-side session cookies
      document.cookie = "_cth_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "_cth_jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "_medusa_jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

      logout().catch(() => null);
    } catch {
      // Fallback
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      isLoading={loading}
      onClick={handleLogout}
      className={`${fullWidth ? "w-full justify-center" : ""} flex items-center gap-2 font-medium transition-colors ${className}`}
      aria-label="Logout of CakeToHome session"
    >
      <LogOut className="w-4 h-4 shrink-0" />
      <span>Logout</span>
    </Button>
  );
}
