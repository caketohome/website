export type CartDTO = any;
export type CartLineItemDTO = any;
export type OrderDTO = any;
export type OrderLineItemDTO = any;
export type ProductDTO = any;
export type ProductVariantDTO = any;
export type ProductCategoryDTO = any;

export namespace HttpTypes {
  export type StoreProductCategory = any;
  export type StoreCart = any;
  export type StoreProduct = any;
  export type StoreOrder = any;
  export type StoreCustomer = any;
}

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
  branch_id?: string;
  role?: string;
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

export interface OrderOperationalDTO {
  order_id: string;
  display_order_number: string;
  order_number: string;
  customer_uid?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  branch_id: string;
  branch_name?: string;
  delivery_partner_id?: string | null;
  delivery_partner_name?: string | null;
  delivery_partner_phone?: string | null;
  payment_status: string;
  payment_method?: string;
  order_status: string;
  delivery_status: DeliveryStatus | string;
  pickup_otp?: string;
  delivery_otp?: string;
  pickup_verified_at?: string | null;
  delivered_at?: string | null;
  total_amount: number;
  delivery_address: string;
  pincode: string;
  city: string;
  landmark?: string;
  delivery_instructions?: string;
  gift_message?: string;
  delivery_date?: string | null;
  delivery_slot?: string | null;
  items: any[];
  timeline?: any[];
  created_at: string;
  updated_at: string;
}

export interface DeliveryDTO {
  id: string;
  order_id?: string;
  display_order_number?: string;
  order_number?: string;
  customer_uid?: string;
  transaction_id?: string;
  delivery_partner_id?: string | null;
  cart?: CartDTO;
  order?: OrderDTO;
  shop?: ShopDTO;
  delivered_at?: Date | string;
  delivery_status: DeliveryStatus;
  status?: string;
  created_at?: Date | string;
  updated_at?: Date | string;
  eta?: Date | string;
  items?: DeliveryItemDTO[];
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
  scheduled_delivery_at?: Date | string;
  scheduled_slot?: string;
  delivery_otp?: string;
  pickup_otp?: string;
}

export type DeliveryItemDTO = (CartLineItemDTO | OrderLineItemDTO) & {
  quantity: number;
};

export interface DeliveryPartnerDTO {
  id: string;
  partner_number?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  rating?: number;
  total_deliveries?: number;
  availability_status?: string;
  primary_branch_name?: string;
  current_active_orders?: number;
  maximum_concurrent_orders?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface DeliveryClaimDTO {
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
