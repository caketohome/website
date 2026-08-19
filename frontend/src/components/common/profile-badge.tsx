"use client";

import React, { memo } from "react";
import { ProfileMenu, type ProfileUserDTO } from "../layout/profile-menu";
import { useAuth } from "@/providers/auth-provider";

type ProfileBadgeProps = {
  user?: ProfileUserDTO | null;
  isLoading?: boolean;
  className?: string;
  showNameOnDesktop?: boolean;
};

export const ProfileBadge = memo(function ProfileBadge({
  user: initialUser = null,
  isLoading = false,
  className = "",
  showNameOnDesktop = true,
}: ProfileBadgeProps) {
  const { currentUser, loading: authLoading } = useAuth();

  // If client-side auth state is resolved, use currentUser; otherwise fall back to initialUser
  const activeUser = currentUser !== undefined ? currentUser : initialUser;
  const effectiveLoading = isLoading || (authLoading && !initialUser);

  return (
    <ProfileMenu
      user={activeUser as ProfileUserDTO}
      isLoading={effectiveLoading}
      className={className}
      showNameOnDesktop={showNameOnDesktop}
    />
  );
});
