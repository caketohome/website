# CAKETOHOME — PHASE 6.1.2 WEBHOOK & SIGNATURE SECURITY
## CASHFREE PG HMAC-SHA256 SIGNATURE VERIFICATION & REPLAY DEFENSE

**Company:** CakeToHome India Private Limited  
**Security Standard:** RBI PA/PG Guidelines & OWASP Top 10

---

### 1. CASHFREE SIGNATURE ALGORITHM

Cashfree webhook signatures are calculated using HMAC-SHA256 Base64 encoding:
```typescript
function verifyCashfreeWebhook(
  rawBody: string,
  timestamp: string,
  signature: string,
  secretKey: string
): boolean {
  // Check replay window (maximum 300 seconds)
  const currentTs = Math.floor(Date.now() / 1000);
  const eventTs = parseInt(timestamp, 10);
  if (Math.abs(currentTs - eventTs) > 300) {
    return false;
  }

  // Calculate signature
  const data = timestamp + rawBody;
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(data)
    .digest('base64');

  // Timing-safe comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSignature, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expBuf);
}
```

### 2. DECOMMISSIONED RAZORPAY WEBHOOK HANDLER

The endpoint `/api/v1/webhooks/razorpay` rejects all inbound webhooks unconditionally:
```typescript
@Post('razorpay')
@Public()
rejectRazorpayWebhook() {
  throw new GoneException('Razorpay has been decommissioned. Cashfree is the sole active payment gateway.');
}
```
