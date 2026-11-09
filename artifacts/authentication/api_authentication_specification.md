# CakeToHome — API Authentication & Session Specification

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**API Prefix:** `/api/v1/auth`  

---

## 1. Authentication Endpoints

### 1.1 `POST /api/v1/auth/request-otp`
Requests a 6-digit verification code sent via SMS.
- **Request Body**:
  ```json
  {
    "phone": "+919876543210",
    "method": "OTP_SMS"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "OTP sent successfully to +91 98765 43210",
    "phone": "+91 98765 43210",
    "account_exists": true,
    "role": "CUSTOMER"
  }
  ```
- **Rate Limit**: Max 1 request per 30 seconds per phone number.

### 1.2 `POST /api/v1/auth/verify-otp`
Verifies the 6-digit OTP code, issues JWT session, and syncs profile.
- **Request Body**:
  ```json
  {
    "phone": "+919876543210",
    "code": "123456",
    "name": "Artisan Customer",
    "email": "customer@example.com"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "CUSTOMER",
    "customer_id": "047ac637-d35e-41bd-a2ad-4d5822a4d6cc",
    "customer_uid": "cth_cus_9876543210",
    "is_new_customer": false,
    "user": {
      "id": "047ac637-d35e-41bd-a2ad-4d5822a4d6cc",
      "name": "Artisan Customer",
      "phone": "+91 98765 43210",
      "email": "customer@example.com",
      "role": "CUSTOMER"
    }
  }
  ```
- **Cookies Set**:
  - `_cth_jwt`: Cryptographic JWT (SameSite=Lax, MaxAge=30 days)
  - `_cth_role`: Authoritative user role (`CUSTOMER`, `STORE_MANAGER`, etc.)
  - `_cth_user_id`: UUID linked to `auth.users.id`
  - `_cth_phone`: Verified phone number

### 1.3 `POST /api/v1/auth/logout`
Invalidates active session and clears all authentication cookies.
- **Request Body**:
  ```json
  {
    "reason": "user_initiated"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```
- **Cookie Clearing**: Expires `_cth_jwt`, `_medusa_jwt`, `_cth_role`, `_cth_user_id`, `_cth_phone`, `_cth_branch_id`.

---

## 2. Server-Side Route Guard & Token Resolution

Private API routes resolve caller identity through `resolveServerSession(req)` in `frontend/src/lib/security/auth-session.ts`:
1. Extracts Bearer token from `Authorization` header or `_cth_jwt` cookie.
2. Cryptographically verifies HMAC SHA-256 signature against `JWT_SECRET`.
3. Verifies token expiration (`exp`).
4. Rejects spoofed client-supplied user IDs or role headers.
