import { CustomerRepository } from "../repositories/customer.repository";
import { FavoriteRepository } from "../repositories/favorite.repository";
import { ReviewRepository } from "../repositories/review.repository";
import { CustomerDomain, CustomerAddressDomain, CustomerFavoriteDomain, ProductReviewDomain } from "../types/domain";

export class CustomerService {
  /**
   * Get customer profile by UID
   */
  static async getProfile(customerUid: string): Promise<CustomerDomain | null> {
    return CustomerRepository.findById(customerUid);
  }

  /**
   * Save / update address
   */
  static async saveAddress(customerUid: string, address: Partial<CustomerAddressDomain>): Promise<void> {
    await CustomerRepository.saveAddress(customerUid, address);
  }

  /**
   * Delete address
   */
  static async deleteAddress(addressId: string): Promise<void> {
    await CustomerRepository.deleteAddress(addressId);
  }

  /**
   * Get customer favorites
   */
  static async getFavorites(customerUid: string): Promise<CustomerFavoriteDomain[]> {
    return FavoriteRepository.findByCustomerUid(customerUid);
  }

  /**
   * Add favorite
   */
  static async addFavorite(customerUid: string, productId: string): Promise<void> {
    await FavoriteRepository.save({
      id: `fav_${customerUid}_${productId}`,
      customer_uid: customerUid,
      product_id: productId,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Remove favorite
   */
  static async removeFavorite(customerUid: string, productId: string): Promise<void> {
    await FavoriteRepository.delete(customerUid, productId);
  }

  /**
   * Submit product review
   */
  static async submitReview(review: Partial<ProductReviewDomain>): Promise<void> {
    await ReviewRepository.save(review);
  }
}
