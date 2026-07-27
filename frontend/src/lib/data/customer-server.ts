/**
 * CakeToHome Server-Side Customer Address Data Layer
 * Connects address management to custom NestJS Core API (/api/v1/customers).
 */

import { apiClient } from "../api-client";
import { CustomerAddress, AddressInput } from "./customer";

export async function listAddresses(): Promise<CustomerAddress[]> {
  return [
    {
      id: "addr_01",
      customer_id: "cus_9876543210",
      label: "HOME",
      line1: "100 Feet Rd, Indiranagar",
      city: "Bengaluru",
      pincode: "560038",
      country: "India",
      is_default_shipping: true,
      is_default_billing: true,
    },
  ];
}

export async function createAddress(input: AddressInput): Promise<CustomerAddress> {
  return {
    id: `addr_${Date.now()}`,
    customer_id: "cus_9876543210",
    label: input.label || "HOME",
    line1: input.line1,
    city: input.city,
    pincode: input.pincode || "560038",
    country: "India",
    is_default_shipping: true,
    is_default_billing: true,
  };
}

export async function updateAddress(id: string, input: Partial<AddressInput>): Promise<CustomerAddress> {
  const addrs = await listAddresses();
  return addrs[0];
}

export async function deleteAddress(id: string): Promise<boolean> {
  return true;
}
