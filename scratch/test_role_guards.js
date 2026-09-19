async function testRoleGuards() {
  console.log("=== Testing Role Guards on /dashboard ===");
  
  // 1. Unauthenticated
  const res1 = await fetch('http://localhost:3000/dashboard', { redirect: 'manual' });
  console.log('Unauthenticated /dashboard:', res1.status, res1.headers.get('location'));

  // 2. Customer role
  const res2 = await fetch('http://localhost:3000/dashboard', {
    headers: { cookie: '_cth_role=CUSTOMER; _cth_user_id=cus_01; _cth_phone=9876543210' },
    redirect: 'manual'
  });
  console.log('Customer role /dashboard:', res2.status, res2.headers.get('location'));

  // 3. Delivery Partner role
  const res3 = await fetch('http://localhost:3000/dashboard', {
    headers: { cookie: '_cth_role=DELIVERY_PARTNER; _cth_user_id=dlp_01; _cth_phone=9876543211' },
    redirect: 'manual'
  });
  console.log('Delivery Partner role /dashboard:', res3.status, res3.headers.get('location'));

  // 4. Super Admin role
  const res4 = await fetch('http://localhost:3000/dashboard', {
    headers: { cookie: '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_phone=9999999999' },
    redirect: 'manual'
  });
  console.log('Super Admin role /dashboard:', res4.status, res4.headers.get('location'));
}

testRoleGuards().catch(console.error);
