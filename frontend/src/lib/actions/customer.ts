"use server";

import { createAddress, deleteAddress } from "../data/customer-server";
import { AddressInput } from "../data/customer";

export async function createAddressAction(input: AddressInput) {
  return createAddress(input);
}

export async function deleteAddressAction(id: string) {
  return deleteAddress(id);
}
