const crypto = require('crypto');

function signAuthToken(payload, secret = 'supersecret') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    userId: payload.userId || 'usr_superadmin',
    role: payload.role || 'SUPER_ADMIN',
    email: payload.email || 'superadmin@caketohome.com',
    permissions: payload.permissions || ['*'],
    iat: now,
    exp: now + 7 * 86400,
    ...payload,
  };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
  return `${encHeader}.${encPayload}.${sig}`;
}

async function testBatchApi() {
  const token = signAuthToken({ userId: 'usr_superadmin', role: 'SUPER_ADMIN' });
  // Find latest batch
  const listRes = await fetch('http://localhost:3000/api/v1/admin/corporate-gifting/batches', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listData = await listRes.json();
  console.log('List batches:', listData.batches?.length);
  if (!listData.batches || listData.batches.length === 0) return;
  const batchId = listData.batches[0].id;
  const detailRes = await fetch(`http://localhost:3000/api/v1/admin/corporate-gifting/batches/${batchId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const detailData = await detailRes.json();
  console.log('detailData:', detailData);
}

testBatchApi().catch(console.error);
