import { dbQuery } from "../db";
import { CustomerFavoriteDomain } from "../types/domain";

export class FavoriteRepository {
  /**
   * Find favorites by customer UID with pagination
   */
  static async findByCustomerUid(
    customerUid: string,
    options?: { page?: number; pageSize?: number; limit?: number; offset?: number }
  ): Promise<CustomerFavoriteDomain[]> {
    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.min(Math.max(1, options?.pageSize || options?.limit || 20), 100);
    const offset = options?.offset !== undefined ? Math.max(0, options.offset) : (page - 1) * pageSize;

    const res = await dbQuery(
      `SELECT * FROM "customer_favorite" 
       WHERE customer_uid = $1 AND deleted_at IS NULL 
       ORDER BY created_at DESC, id DESC 
       LIMIT $2 OFFSET $3`,
      [customerUid, pageSize, offset]
    );

    return (res.rows || []).map((fav: any) => ({
      id: fav.id,
      customer_uid: fav.customer_uid,
      product_id: fav.product_id,
      created_at: fav.created_at,
    }));
  }

  /**
   * Save customer favorite in PostgreSQL
   */
  static async save(favorite: CustomerFavoriteDomain): Promise<void> {
    const id = favorite.id || `fav_${favorite.customer_uid}_${favorite.product_id}`;
    await dbQuery(
      `
      INSERT INTO "customer_favorite" (id, customer_uid, product_id, created_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        deleted_at = NULL
    `,
      [id, favorite.customer_uid, favorite.product_id, favorite.created_at ? new Date(favorite.created_at) : new Date()]
    );
  }

  /**
   * Delete customer favorite from PostgreSQL
   */
  static async delete(customerUid: string, productId: string): Promise<void> {
    await dbQuery(
      `DELETE FROM "customer_favorite" WHERE (customer_uid = $1 AND product_id = $2) OR id = $3`,
      [customerUid, productId, `fav_${customerUid}_${productId}`]
    );
  }
}
