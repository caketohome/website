"use client";

import { setShopStatus } from "@frontend/lib/actions";
import { ShopDTO } from "@frontend/lib/types";
import { Switch } from "@medusajs/ui";
import { useState } from "react";

export default function ShopStatus({
  shop,
}: {
  shop: ShopDTO;
}) {
  const [isOpen, setIsOpen] = useState(shop.is_open);

  const handleStatusChange = async () => {
    setIsOpen(!isOpen);
    await setShopStatus(shop.id, !isOpen);
  };

  return (
    <div className="flex items-center gap-x-2">
      <Switch
        id="manage-inventory"
        onCheckedChange={handleStatusChange}
        checked={isOpen}
      />
    </div>
  );
}
