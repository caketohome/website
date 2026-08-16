"use client";

import React, { memo } from "react";
import { ProfileMenu, type ProfileUserDTO } from "../layout/profile-menu";

type ProfileBadgeProps = {
  user: ProfileUserDTO | null;
  isLoading?: boolean;
  className?: string;
  showNameOnDesktop?: boolean;
};

export const ProfileBadge = memo(function ProfileBadge({
  user,
  isLoading = false,
  className = "",
  showNameOnDesktop = true,
}: ProfileBadgeProps) {
  return (
    <ProfileMenu
      user={user}
      isLoading={isLoading}
      className={className}
      showNameOnDesktop={showNameOnDesktop}
    />
  );
});
