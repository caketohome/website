import {
  EllipsisHorizontal,
  PencilSquare,
  Trash,
  XCircleSolid,
} from "@medusajs/icons";
import { DropdownMenu, IconButton } from "@medusajs/ui";
import { DeliveryPartnerDTO } from "../../modules/delivery/types/common";

const DeliveryPartnerActionsMenu = ({ delivery_partner }: { delivery_partner: DeliveryPartnerDTO }) => {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton variant="transparent">
          <EllipsisHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item className="gap-x-2">
          <PencilSquare className="text-ui-fg-subtle" />
          Edit
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item className="gap-x-2 text-ui-tag-red-text">
          <XCircleSolid className="text-ui-tag-red-icon" />
          Fire {delivery_partner.first_name}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};

export default DeliveryPartnerActionsMenu;
