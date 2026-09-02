import { dbQuery, dbTransaction } from "../db";
import { CustomerDomain, CustomerAddressDomain } from "../types/domain";

export class CustomerRepository {
  /**
   * Find all customers with their addresses from PostgreSQL
   */
  static async findAll(): Promise<CustomerDomain[]> {
    const [customersRes, addressesRes] = await Promise.all([
      dbQuery(`SELECT * FROM "customer" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
      dbQuery(`SELECT * FROM "customer_address" WHERE deleted_at IS NULL ORDER BY created_at ASC`),
    ]);

    const addrsByCust = new Map<string, CustomerAddressDomain[]>();
    for (const a of addressesRes.rows || []) {
      const cId = a.customer_id;
      if (!addrsByCust.has(cId)) {
        addrsByCust.set(cId, []);
      }
      const meta = a.metadata || {};
      addrsByCust.get(cId)!.push({
        id: a.id,
        customer_id: a.customer_id,
        first_name: a.first_name,
        last_name: a.last_name,
        name: `${a.first_name || ""} ${a.last_name || ""}`.trim() || "Customer",
        address_1: a.address_1,
        address_2: a.address_2 || "",
        city: a.city,
        postal_code: a.postal_code,
        pincode: a.postal_code,
        phone: a.phone || "",
        landmark: meta.landmark || "",
        latitude: meta.latitude,
        longitude: meta.longitude,
        is_default: Boolean(meta.is_default),
        type: meta.type || "HOME",
        label: meta.label || "Home",
      });
    }

    return (customersRes.rows || []).map((c: any) => {
      const meta = c.metadata || {};
      const custAddrs = addrsByCust.get(c.id) || meta.addresses || [];
      return {
        id: c.id,
        customer_uid: meta.customer_uid || c.id,
        first_name: c.first_name || "",
        last_name: c.last_name || "",
        name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Valued Customer",
        full_name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Valued Customer",
        email: c.email || "",
        phone: c.phone || "",
        normalized_phone: meta.normalized_phone || c.phone,
        role: meta.role || "CUSTOMER",
        wallet_balance: Number(meta.wallet_balance || 0),
        addresses: custAddrs,
        preferences: meta.preferences || {},
        orders_count: Number(meta.orders_count || 0),
        total_spend: Number(meta.total_spend || 0),
        created_at: c.created_at,
        updated_at: c.updated_at,
      };
    });
  }

  /**
   * Find customer by ID, customer_uid, email, or phone
   */
  static async findById(idOrPhone: string): Promise<CustomerDomain | null> {
    const clean = idOrPhone.replace(/\D/g, "");
    const res = await dbQuery(
      `SELECT * FROM "customer" WHERE (id = $1 OR email = $1 OR phone = $1 OR phone = $2) AND deleted_at IS NULL LIMIT 1`,
      [idOrPhone, clean ? `+91${clean.slice(-10)}` : idOrPhone]
    );
    if (!res.rows || res.rows.length === 0) return null;
    const c = res.rows[0];
    const addrsRes = await dbQuery(
      `SELECT * FROM "customer_address" WHERE customer_id = $1 AND deleted_at IS NULL`,
      [c.id]
    );
    const meta = c.metadata || {};
    const addrs = (addrsRes.rows || []).map((a: any) => ({
      id: a.id,
      customer_id: a.customer_id,
      first_name: a.first_name,
      last_name: a.last_name,
      name: `${a.first_name || ""} ${a.last_name || ""}`.trim() || "Customer",
      address_1: a.address_1,
      address_2: a.address_2 || "",
      city: a.city,
      postal_code: a.postal_code,
      pincode: a.postal_code,
      phone: a.phone || "",
      landmark: a.metadata?.landmark || "",
      latitude: a.metadata?.latitude,
      longitude: a.metadata?.longitude,
      is_default: Boolean(a.metadata?.is_default),
      type: a.metadata?.type || "HOME",
      label: a.metadata?.label || "Home",
    }));

    return {
      id: c.id,
      customer_uid: meta.customer_uid || c.id,
      first_name: c.first_name || "",
      last_name: c.last_name || "",
      name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Valued Customer",
      full_name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Valued Customer",
      email: c.email || "",
      phone: c.phone || "",
      normalized_phone: meta.normalized_phone || c.phone,
      role: meta.role || "CUSTOMER",
      wallet_balance: Number(meta.wallet_balance || 0),
      addresses: addrs,
      preferences: meta.preferences || {},
      orders_count: Number(meta.orders_count || 0),
      total_spend: Number(meta.total_spend || 0),
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  /**
   * Save / update customer directly in PostgreSQL
   */
  static async save(customer: Partial<CustomerDomain>): Promise<void> {
    const id = customer.id || customer.customer_uid || `cus_${Date.now()}`;
    const cleanPhone = customer.phone ? customer.phone.replace(/\D/g, "").slice(-10) : "";
    const normPhone = cleanPhone ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}` : (customer.phone || "");

    const metadata = {
      customer_uid: customer.customer_uid || id,
      normalized_phone: normPhone,
      role: customer.role || "CUSTOMER",
      wallet_balance: customer.wallet_balance || 0,
      preferences: customer.preferences || {},
      orders_count: customer.orders_count || 0,
      total_spend: customer.total_spend || 0,
    };

    await dbQuery(
      `
      INSERT INTO "customer" (id, first_name, last_name, email, phone, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
      [
        id,
        customer.first_name || "",
        customer.last_name || "",
        customer.email || `customer_${id.slice(-6)}@caketohome.internal`,
        customer.phone || normPhone,
        JSON.stringify(metadata),
      ]
    );
  }

  /**
   * Save / update customer address directly in PostgreSQL
   */
  static async saveAddress(customerId: string, address: Partial<CustomerAddressDomain>): Promise<void> {
    const id = address.id || `addr_${customerId}_${Date.now()}`;
    const metadata = {
      landmark: address.landmark || "",
      latitude: address.latitude,
      longitude: address.longitude,
      is_default: Boolean(address.is_default),
      type: address.type || "HOME",
      label: address.label || "Home",
    };

    await dbQuery(
      `
      INSERT INTO "customer_address" (id, customer_id, first_name, last_name, address_1, address_2, city, postal_code, phone, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        address_1 = EXCLUDED.address_1,
        address_2 = EXCLUDED.address_2,
        city = EXCLUDED.city,
        postal_code = EXCLUDED.postal_code,
        phone = EXCLUDED.phone,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
      [
        id,
        customerId,
        address.first_name || "",
        address.last_name || "",
        address.address_1 || "Address Line 1",
        address.address_2 || "",
        address.city || "Bengaluru",
        address.postal_code || address.pincode || "560001",
        address.phone || "",
        JSON.stringify(metadata),
      ]
    );
  }

  /**
   * Delete customer address in PostgreSQL
   */
  static async deleteAddress(addressId: string): Promise<void> {
    await dbQuery(`UPDATE "customer_address" SET deleted_at = NOW() WHERE id = $1`, [addressId]);
  }
}
