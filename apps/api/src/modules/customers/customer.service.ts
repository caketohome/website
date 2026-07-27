/**
 * CakeToHome Core API - Customer Experience Portal Domain Service (Feature 12)
 * Manages Profile, Address Book, Wallet Balance Ledger, Loyalty Points, Wishlist,
 * Saved Occasions (Birthdays/Anniversaries), One-Touch Reordering, and Outbox Events.
 */

import { OutboxPublisherService } from "../../core/events/outbox-publisher.service.ts";

export interface AddressBookDto {
  id: string;
  tag: "HOME" | "WORK" | "OTHER";
  street: string;
  city: string;
  pincode: string;
  isDefault: boolean;
}

export interface OccasionDto {
  id: string;
  title: string;
  personName: string;
  date: string;
  relationship: string;
}

export interface CustomerProfileDto {
  id: string;
  userId: string;
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  walletBalance: string;
  loyaltyPoints: number;
  addresses: AddressBookDto[];
  occasions: OccasionDto[];
  wishlistProductIds: string[];
}

export class CustomerService {
  private customers: Map<string, CustomerProfileDto> = new Map();

  constructor() {
    const alex: CustomerProfileDto = {
      id: "cus_9876543210",
      userId: "usr_alex_100",
      phone: "9876543210",
      email: "alex@cakes2home.com",
      firstName: "Alex",
      lastName: "Johnson",
      walletBalance: "250.00",
      loyaltyPoints: 120,
      addresses: [
        { id: "addr_01", tag: "HOME", street: "100 Feet Rd, Indiranagar", city: "Bengaluru", pincode: "560038", isDefault: true },
      ],
      occasions: [
        { id: "occ_01", title: "Wife Birthday", personName: "Sarah", date: "2026-08-15", relationship: "Wife" },
      ],
      wishlistProductIds: ["prod_truffle_01"],
    };

    this.customers.set(alex.id, alex);
  }

  async getProfile(customerId: string): Promise<CustomerProfileDto | null> {
    return this.customers.get(customerId) || null;
  }

  async creditWallet(customerId: string, amount: string, reason: string): Promise<{ walletBalance: string; outboxEvent: any }> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error("Customer profile not found");

    const newBal = parseFloat(customer.walletBalance) + parseFloat(amount);
    customer.walletBalance = newBal.toFixed(2);

    const outboxEvent = OutboxPublisherService.createOutboxRecord({
      eventType: "CustomerWalletCredited",
      aggregateId: customerId,
      payload: { customerId, amount, newBalance: customer.walletBalance, reason },
    });

    return { walletBalance: customer.walletBalance, outboxEvent };
  }

  async addAddress(customerId: string, address: Omit<AddressBookDto, "id">): Promise<AddressBookDto> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error("Customer profile not found");

    const newAddr: AddressBookDto = {
      id: `addr_${Date.now()}`,
      ...address,
    };

    customer.addresses.push(newAddr);
    return newAddr;
  }

  async toggleWishlist(customerId: string, productId: string): Promise<{ inWishlist: boolean }> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error("Customer profile not found");

    const index = customer.wishlistProductIds.indexOf(productId);
    let inWishlist = false;

    if (index >= 0) {
      customer.wishlistProductIds.splice(index, 1);
      inWishlist = false;
    } else {
      customer.wishlistProductIds.push(productId);
      inWishlist = true;
    }

    return { inWishlist };
  }
}
