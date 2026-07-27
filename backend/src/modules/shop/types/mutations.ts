export interface CreateShopDTO {
  name: string;
  handle: string;
  address: string;
  phone: string;
  email: string;
  image_url?: string;
  is_open?: boolean;
}

export interface UpdateShopsDTO extends Partial<CreateShopDTO> {
  id: string;
}

export interface CreateShopManagerDTO {
  email: string;
  first_name: string;
  last_name: string;
  shop_id: string;
}

export interface UpdateShopManagersDTO
  extends Partial<CreateShopManagerDTO> {
  id: string;
}

export interface CreateAdminInviteDTO {
  shpmgr_id: string;
  role?: string | null;
  email?: string;
}
