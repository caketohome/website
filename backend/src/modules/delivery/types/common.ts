import {
  CartLineItemDTO,
  OrderLineItemDTO,
  CartDTO,
  OrderDTO,
} from "@medusajs/types";
import { ShopDTO } from "../../shop/types/common";
import DeliveryModuleService from "../service";

export enum DeliveryStatus {
  PENDING = "pending",
  SHOP_DECLINED = "shop_declined",
  SHOP_ACCEPTED = "shop_accepted",
  PICKUP_CLAIMED = "pickup_claimed",
  SHOP_PREPARING = "shop_preparing",
  READY_FOR_PICKUP = "ready_for_pickup",
  IN_TRANSIT = "in_transit",
  DELIVERED = "delivered",
}

export interface DeliveryDTO {
  id: string;
  transaction_id: string;
  delivery_partner_id?: string;
  delivered_at?: Date;
  delivery_status: DeliveryStatus;
  created_at: Date;
  updated_at: Date;
  eta?: Date;
  items: DeliveryItemDTO[];
  cart?: CartDTO;
  order?: OrderDTO;
  shop: ShopDTO;
}

export type DeliveryItemDTO = (CartLineItemDTO | OrderLineItemDTO) & {
  quantity: number;
};

export interface DeliveryPartnerDTO {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DeliveryDeliveryPartnerDTO {
  id: string;
  delivery_id: string;
  delivery_partner_id: string;
}

declare module "@medusajs/types" {
  export interface ModuleImplementations {
    deliveryModuleService: DeliveryModuleService;
  }
}

