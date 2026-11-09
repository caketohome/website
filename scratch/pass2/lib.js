/**
 * PRG-01 Acceptance Pass 2 — shared helpers.
 * Reads DATABASE_URL / JWT_SECRET from frontend/.env (never prints them).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require(path.resolve(__dirname, '..', '..', 'frontend', 'node_modules', 'pg'));

const ROOT = path.resolve(__dirname, '..', '..');
const EVIDENCE = path.join(ROOT, 'CHECKPOINTS', 'acceptance-test-evidence', 'pass-2');
fs.mkdirSync(EVIDENCE, { recursive: true });

function loadEnv() {
  const env = {};
  for (const f of [path.join(ROOT, 'frontend', '.env'), path.join(ROOT, '.env')]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}
const ENV = loadEnv();
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});
const q = (sql, params = []) => pool.query(sql, params);

function signJWT(payload, expiresInSeconds = 86400) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const full = {
    ...payload,
    isSuperAdmin: payload.role === 'SUPER_ADMIN' || payload.userId === 'admin_01',
    iat: now,
    exp: now + expiresInSeconds,
  };
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', ENV.JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

async function api(method, urlPath, { token, body, raw } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `_cth_jwt=${token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const ct = res.headers.get('content-type') || '';
  let data;
  if (raw) data = await res.text();
  else if (ct.includes('json')) data = await res.json().catch(() => null);
  else data = (await res.text()).slice(0, 400);
  return { status: res.status, data, headers: res.headers };
}

const results = [];
function rec(id, name, pass, detail) {
  results.push({ id, name, status: pass === 'NA' ? 'N/A' : pass === 'BLOCKED' ? 'BLOCKED' : pass ? 'PASS' : 'FAIL', detail });
  const tag = pass === 'NA' ? 'N/A ' : pass === 'BLOCKED' ? 'BLK ' : pass ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${id} ${name}${detail ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300) : ''}`);
}
function save(name, obj) {
  fs.writeFileSync(path.join(EVIDENCE, name), JSON.stringify(obj, null, 2));
}
const num = (v) => Math.round(parseFloat(v || 0) * 100) / 100;

module.exports = { ROOT, EVIDENCE, ENV, BASE, pool, q, signJWT, api, rec, results, save, num };
