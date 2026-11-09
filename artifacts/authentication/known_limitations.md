# CakeToHome — Known Limitations & External Dependencies

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  

---

## 1. External Infrastructure Dependencies

1. **Active Supabase Project Reference**:
   - The development project references in `.env` (`uubwhsnnrnicyczwqlbq` and `xfvgumatwucammmbwdwv`) are currently unreachable over public DNS (tenant not found on pooler `aws-1-ap-south-1.pooler.supabase.com:6543`).
   - A live, provisioned production Supabase project must be linked and configured before production deployment.
2. **Indian DLT Telecom Provider Credentials**:
   - Sending real SMS messages to Indian phone numbers (`+91`) requires TRAI DLT registration and live provider credentials (e.g., Twilio Account SID/Token or Fast2SMS/MSG91 API keys).
   - Until live provider credentials are entered in the Supabase console, real SMS delivery remains pending.

---

## 2. Technical Safeguards & Current Boundaries

1. **Fail-Closed OTP Gate**: The application will not simulate or fabricate synthetic production SMS delivery.
2. **Localhost Isolation Guard**: The test runner enforces that `TEST_DATABASE_URL` never targets external Supabase poolers, preventing accidental pollution or leakage during CI/CD.
3. **Database-Backed Authoritative RBAC**: Even if a client bypasses UI controls or presents tampered token claims, PostgreSQL Row Level Security and server-side route guards strictly reject unauthorized data access.
