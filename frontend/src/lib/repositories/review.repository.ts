import { dbQuery } from "../db";
import { ProductReviewDomain } from "../types/domain";

export class ReviewRepository {
  /**
   * Find reviews by product ID
   */
  static async findByProductId(productId: string): Promise<ProductReviewDomain[]> {
    const res = await dbQuery(
      `SELECT * FROM "product_review" WHERE (product_id = $1 OR product_id = $2) AND deleted_at IS NULL ORDER BY created_at DESC`,
      [productId, `prod_${productId}`]
    );

    return (res.rows || []).map((rev: any) => {
      const replyObj = rev.reply ? {
        author: "CakeToHome Bakery Chef",
        message: rev.reply,
        responded_at: rev.replied_at || rev.updated_at,
      } : (rev.admin_response ? (typeof rev.admin_response === "string" ? JSON.parse(rev.admin_response) : rev.admin_response) : null);

      return {
        id: rev.id,
        product_id: rev.product_id,
        customer_uid: rev.customer_uid || rev.customer_id || "guest",
        customer_id: rev.customer_id || rev.customer_uid,
        customer_name: rev.customer_name || "Valued Customer",
        order_id: rev.order_id || null,
        order_item_id: rev.order_item_id || null,
        rating: Number(rev.rating || 5),
        title: rev.title || "",
        review_text: rev.review_text || rev.body || "",
        body: rev.body || rev.review_text || "",
        purchased_variant: rev.purchased_variant || null,
        is_verified_purchase: rev.is_verified_purchase !== undefined ? rev.is_verified_purchase : (rev.verified_purchase !== false),
        verified_purchase: rev.verified_purchase !== false,
        status: rev.status || "APPROVED",
        admin_response: replyObj,
        reply: rev.reply,
        replied_at: rev.replied_at,
        helpful_votes: Number(rev.helpful_votes || 0),
        created_at: rev.created_at,
        updated_at: rev.updated_at,
        published_at: rev.published_at || rev.created_at,
      };
    });
  }

  /**
   * Save / update review in PostgreSQL
   */
  static async save(review: Partial<ProductReviewDomain>): Promise<void> {
    const id = review.id || `rev_${Date.now()}`;
    const customerId = review.customer_uid || review.customer_id || "guest";
    const bodyText = review.review_text || review.body || "";
    const replyText = review.admin_response?.message || review.reply || null;
    const repliedAt = review.admin_response?.responded_at ? new Date(review.admin_response.responded_at) : null;
    const isVerified = review.is_verified_purchase !== false && review.verified_purchase !== false;

    await dbQuery(
      `
      INSERT INTO "product_review" (
        id, product_id, customer_id, customer_name,
        rating, title, body,
        status, reply, replied_at, verified_purchase, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (id) DO UPDATE SET
        rating = EXCLUDED.rating,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        status = EXCLUDED.status,
        reply = EXCLUDED.reply,
        replied_at = EXCLUDED.replied_at,
        updated_at = NOW()
    `,
      [
        id,
        review.product_id,
        customerId,
        review.customer_name || "Valued Customer",
        Number(review.rating || 5),
        review.title || "",
        bodyText,
        review.status || "APPROVED",
        replyText,
        repliedAt,
        isVerified,
        review.created_at ? new Date(review.created_at) : new Date(),
      ]
    );
  }

  /**
   * Delete review in PostgreSQL
   */
  static async delete(id: string): Promise<void> {
    await dbQuery(`UPDATE "product_review" SET deleted_at = NOW(), status = 'HIDDEN' WHERE id = $1`, [id]);
  }
}
