/**
 * CakeToHome Commerce Platform Initial Seed Script
 * Seeds store, branches, categories, products, variants, and admin user.
 */

const { PrismaClient } = require('@prisma/client');

async function seed() {
  console.log('🌱 Initiating CakeToHome Seed Process...');
  const prisma = new PrismaClient();

  try {
    // 1. Create Store
    const store = await prisma.store.upsert({
      where: { code: 'default_store' },
      update: { name: 'CakeToHome Admin' },
      create: {
        code: 'default_store',
        name: 'CakeToHome Admin',
        currency: 'INR',
      },
    });
    console.log('✓ Store created:', store.name);

    // 2. Create Branch
    const branch = await prisma.branch.upsert({
      where: { code: 'BLR_CENTRAL' },
      update: { name: 'CakeToHome Central Branch' },
      create: {
        code: 'BLR_CENTRAL',
        storeId: store.id,
        name: 'CakeToHome Central Branch',
        address: '100 Feet Road, Indiranagar, Bengaluru',
        pincode: '560038',
        phone: '+91 98765 43210',
      },
    });
    console.log('✓ Branch created:', branch.name);

    // 3. Create Admin User
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@cakes2home.com' },
      update: { role: 'SUPER_ADMIN' },
      create: {
        email: 'admin@cakes2home.com',
        phone: '9876543210',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
      },
    });
    console.log('✓ Admin user created:', adminUser.email);

    // 4. Create Category
    const category = await prisma.category.upsert({
      where: { slug: 'signature-cakes' },
      update: { name: 'Signature Cakes' },
      create: {
        name: 'Signature Cakes',
        slug: 'signature-cakes',
        description: 'Freshly baked artisanal gourmet cakes',
      },
    });
    console.log('✓ Category created:', category.name);

    // 5. Create Product
    const product = await prisma.product.upsert({
      where: { slug: 'truffle-delight' },
      update: { title: 'Rich Chocolate Truffle Cake' },
      create: {
        title: 'Rich Chocolate Truffle Cake',
        slug: 'truffle-delight',
        description: 'Decadent dark chocolate truffle cake topped with chocolate glaze',
        price: 599.00,
        categoryId: category.id,
        is_artisan: true,
        isBestseller: true,
      },
    });
    console.log('✓ Product created:', product.title);

    console.log('✨ CakeToHome Database Seeding Complete!');
  } catch (err) {
    console.error('❌ Seeding Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
