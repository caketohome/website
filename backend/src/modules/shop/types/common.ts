import { ProductDTO } from "@medusajs/types";
import ShopModuleService from "../service";

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
}

export interface ShopManagerDTO {
  id: string;
  shop: ShopDTO;
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

declare module "@medusajs/types" {
  export interface ModuleImplementations {
    shopModuleService: ShopModuleService;
  }
}
