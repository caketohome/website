"use client";

import { useState } from "react";
import { authLogout } from "@frontend/lib/auth-service";
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
    if (loading) return;
    setLoading(true);
    try {
      await authLogout({ redirectUrl: "/login", reason: "user_initiated" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      isLoading={loading}
      disabled={loading}
      onClick={handleLogout}
      className={`${fullWidth ? "w-full justify-center" : ""} flex items-center gap-2 font-medium transition-colors ${className}`}
      aria-label="Logout of CakeToHome session"
    >
      <LogOut className="w-4 h-4 shrink-0" />
      <span>{loading ? "Logging out..." : "Logout"}</span>
    </Button>
  );
}
