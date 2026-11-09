# PHASE 6.1.3 — CASHFREE WEB SDK V3 INTEGRATION
## Script Loading, Modal Execution & Redirection Handling
**Entity:** CakeToHome India Private Limited  

---

### 1. SDK Script Loading
- **Official URL:** `https://sdk.cashfree.com/js/v3/cashfree.js`
- **Implementation:** Next.js `<Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" onLoad={...} />`
- **Global Object:** `window.Cashfree`

---

### 2. Initialization & Execution Contract
```typescript
const cashfree = window.Cashfree({
  mode: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});

await cashfree.checkout({
  paymentSessionId: sessionData.paymentSessionId,
  redirectTarget: "_self", // Seamless redirect upon completion
});
```
- Eliminates custom payment popups or mock UI cards.
- Directly invokes Cashfree's hosted PCI-DSS compliant checkout.
