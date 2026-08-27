import React from "react";
import { Badge } from "@medusajs/ui";

interface AccountBadgeProps {
  data: any;
  type?: "delivery_partner" | "shop" | "admin" | "staff";
  className?: string;
}

export default function AccountBadge({ data, type = "delivery_partner", className = "" }: AccountBadgeProps) {
  if (!data) return null;

  let name = "";
  let roleTitle = "Staff";
  let identifier = data.id || "";
  let phone = data.phone || "";
  let email = data.email || "";
  let subText = "";

  if (type === "delivery_partner") {
    name = data.full_name || (data.first_name ? `${data.first_name} ${data.last_name || ""}`.trim() : (data.name || "Delivery Partner"));
    roleTitle = "Delivery Partner";
    identifier = data.partner_number || (data.id ? `DLP-${String(data.id).slice(-4)}` : "DLP");
    subText = data.primary_branch_name || data.branch_name || "Assigned Hub";
  } else if (type === "shop") {
    name = data.name || data.branch_name || "Bakery Branch";
    roleTitle = "Branch Kitchen";
    identifier = data.code || (data.id ? `HUB-${String(data.id).slice(-4)}` : "HUB");
    subText = data.city || data.city_name || "";
  } else {
    name = data.name || data.full_name || "Staff Member";
    roleTitle = data.role || "Operator";
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "DP";

  return (
    <div className={`flex items-center gap-3 bg-ui-bg-subtle/50 dark:bg-ui-bg-subtle/20 border border-ui-border-base rounded-xl px-3.5 py-2.5 shadow-sm ${className}`}>
      <div className="flex flex-col text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <span className="text-xs font-bold text-ui-fg-base leading-none">{name}</span>
          <Badge color={type === "delivery_partner" ? "blue" : "purple"} className="text-[10px] px-1.5 py-0 font-mono">
            {identifier}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 justify-end mt-1 text-[11px] text-ui-fg-subtle">
          <span>{subText || phone || email}</span>
        </div>
      </div>

      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center text-white font-bold text-xs shadow-inner flex-shrink-0">
        {initials}
      </div>
    </div>
  );
}
