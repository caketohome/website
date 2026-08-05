# 03 — Database Design

## Database Technology & ORM
* **Database Engine**: PostgreSQL 16
* **ORM**: Prisma ORM (v5+)
* **Migration Tool**: Prisma Migrate (`npx prisma migrate dev`)

---

## Core Domain Schema Overview

### 1. Customer Identity & Accounts
```prisma
model Customer {
  id           String            @id @default(cuid())
  phone        String            @unique
  email        String?           @unique
  first_name   String?
  last_name    String?
  is_verified  Boolean           @default(false)
  created_at   DateTime          @default(now())
  updated_at   DateTime          @updatedAt
  
  phones       CustomerPhone[]
  addresses    CustomerAddress[]
  login_events LoginEvent[]
  orders       Order[]
  wishlists    WishlistItem[]
  
  @@map("customers")
}

model CustomerPhone {
  id             String    @id @default(cuid())
  phone          String    @unique
  phone_verified Boolean   @default(false)
  otp_hash       String?
  otp_expires_at DateTime?
  otp_attempts   Int       @default(0)
  customer_id    String?
  customer       Customer? @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  created_at     DateTime  @default(now())
  updated_at     DateTime  @updatedAt

  @@map("customer_phones")
}

model CustomerAddress {
  id                   String   @id @default(cuid())
  customer_id          String
  customer             Customer @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  label                String?
  first_name           String?
  last_name            String?
  phone                String?
  line1                String
  line2                String?
  city                 String
  state                String?
  pincode              String
  country              String   @default("IN")
  latitude             Float?
  longitude            Float?
  is_default_shipping Boolean  @default(false)
  is_default_billing  Boolean  @default(false)
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt

  @@index([customer_id])
  @@map("customer_addresses")
}
```

### 2. Multi-Branch Operations & Inventory
```prisma
model Branch {
  id           String            @id @default(cuid())
  name         String
  code         String            @unique
  address      String
  city         String
  pincode      String
  latitude     Float
  longitude    Float
  is_active    Boolean           @default(true)
  created_at   DateTime          @default(now())

  inventories  BranchInventory[]
  slots        DeliverySlot[]
  orders       Order[]

  @@map("branches")
}

model BranchInventory {
  id             String   @id @default(cuid())
  branch_id      String
  branch         Branch   @relation(fields: [branch_id], references: [id], onDelete: Cascade)
  product_id     String
  variant_id     String
  quantity       Int      @default(0)
  reserved       Int      @default(0)
  status         String   @default("AVAILABLE") // AVAILABLE | OUT_OF_STOCK | HIDDEN
  updated_at     DateTime @updatedAt

  @@unique([branch_id, product_id, variant_id])
  @@map("branch_inventories")
}
```

### 3. Delivery Zones & Slot Capacities
```prisma
model DeliveryZone {
  id             String   @id @default(cuid())
  branch_id      String
  pincode        String   @unique
  delivery_fee   Float    @default(0)
  min_order_val  Float    @default(0)
  is_active      Boolean  @default(true)

  @@map("delivery_zones")
}

model DeliverySlot {
  id             String   @id @default(cuid())
  branch_id      String
  branch         Branch   @relation(fields: [branch_id], references: [id], onDelete: Cascade)
  start_time     String   // e.g. "10:00"
  end_time       String   // e.g. "12:00"
  max_capacity   Int      @default(20)
  booked_count   Int      @default(0)
  surcharge      Float    @default(0)
  is_active      Boolean  @default(true)

  @@map("delivery_slots")
}
```

---

## Indexing & Concurrency Constraints
1. **Unique Indexes**: `phone` on `customers`, `[branch_id, product_id, variant_id]` on `branch_inventories`, `pincode` on `delivery_zones`.
2. **Row Locking**: Critical stock reservation transactions use PostgreSQL row locking (`SELECT FOR UPDATE`) within Prisma `$transaction` blocks to guarantee zero inventory overselling.
