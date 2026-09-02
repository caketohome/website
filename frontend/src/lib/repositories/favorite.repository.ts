import { dbQuery } from "../db";
import { CustomerFavoriteDomain } from "../types/domain";

export class FavoriteRepository {
  /**
   * Find favorites by customer UID
   */
  static async findByCustomerUid(customerUid: string): Promise<CustomerFavoriteDomain[]> {
    const res = await dbQuery(
      `SELECT * FROM "customer_favorite" WHERE customer_uid = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [customerUid]
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
