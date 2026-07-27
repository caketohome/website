import {
  CartDTO,
  CartLineItemDTO,
  OrderDTO,
  OrderLineItemDTO,
  ProductDTO,
} from "@medusajs/types";

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

export interface ShopDTO {
  id: string;
  handle: string;
  is_open: boolean;
  name: string;
  description?: string;
  address: string;
  phone: string;
  email: string;
  image_url?: string;
  created_at: Date;
  updated_at: Date;
  products?: ProductDTO[];
  deliveries: DeliveryDTO[];
}

export interface ShopManagerDTO {
  id: string;
  shop_id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

export interface ShopProductDTO {
  shop_id: string;
  product_id: string;
}

export interface CreateShopDTO {
  name: string;
  handle: string;
  address: string;
  phone: string;
  email: string;
  image_url?: string;
  is_open?: boolean;
}

export type UpdateShopDTO = Partial<CreateShopDTO>;

export interface CreateShopManagerDTO {
  email: string;
  first_name: string;
  last_name: string;
  shop_id: string;
}

export interface CreateAdminInviteDTO {
  shpmgr_id: string;
  role?: string | null;
  email?: string;
}

export interface DeliveryDTO {
  id: string;
  transaction_id: string;
  delivery_partner_id?: string;
  cart: CartDTO;
  order?: OrderDTO;
  shop: ShopDTO;
  delivered_at?: Date;
  delivery_status: DeliveryStatus;
  created_at: Date;
  updated_at: Date;
  eta?: Date;
  items: DeliveryItemDTO[];
  ordered_for_self?: boolean;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_alt_phone?: string;
  recipient_address?: string;
  recipient_pincode?: string;
  recipient_landmark?: string;
  delivery_instructions?: string;
  gift_wrap?: boolean;
  greeting_card?: boolean;
  gift_message?: string;
  anonymous_delivery?: boolean;
  hide_invoice?: boolean;
  occasion?: string;
  is_surprise_delivery?: boolean;
  scheduled_delivery_at?: Date;
  scheduled_slot?: string;
  delivery_otp?: string;
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

export interface DeliveryPartnerDTO {
  id: string;
  delivery_id: string;
  delivery_partner_id: string;
}

export interface CreateDeliveryDTO {
  shop_id: string;
  cart_id: string;
}

export interface UpdateDeliveryDTO extends Partial<DeliveryDTO> {
  id: string;
}

export interface CreateDeliveryPartnerDTO {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url?: string;
}

export interface UpdateDeliveryPartnerDTO extends Partial<DeliveryPartnerDTO> {
  id: string;
}

export interface CreateDeliveryPartnerLinkDTO {
  delivery_id: string;
  delivery_partner_id: string;
}
