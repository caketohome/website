const http = require('http');

const payload = {
  cart_id: `cart_audit_mh_${Date.now()}`,
  pincode: "400050",
  branch_id: "br_mumbai_bandra",
  address: {
    first_name: "Pooja",
    last_name: "Deshmukh",
    phone: "+91 98200 44332",
    email: "pooja.deshmukh@example.com",
    line1: "Hill Road, Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    country: "India",
  },
  delivery_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  delivery_slot_id: "slot_eve",
  payment_method: "cod",
};

const req = http.request({
  host: 'localhost',
  port: 3000,
  path: '/api/v1/checkout/confirm',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', err => console.error('Error:', err.message));
req.write(JSON.stringify(payload));
req.end();
