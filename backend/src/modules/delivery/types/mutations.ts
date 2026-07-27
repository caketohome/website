import { DeliveryDTO, DeliveryPartnerDTO } from "./common";

export interface CreateDeliveryDTO {
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
