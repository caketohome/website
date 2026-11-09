# CakeToHome — OTP SMS Provider Configuration Runbook

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**Operational Scope:** Indian Domestic SMS (+91) OTP Delivery  

---

## 1. Provider Evaluation & Indian DLT Compliance

Under Telecom Regulatory Authority of India (TRAI) regulations, commercial transactional SMS requires DLT (Distributed Ledger Technology) registration:
1. **Principal Entity (PE) Registration**: CakeToHome India Private Limited (`U15400KA2026PTC189211`).
2. **Sender Header (Sender ID)**: Approved 6-alpha header (e.g., `CKHOME` or `CTHOME`).
3. **Template Registration**:
   - Template Name: `CakeToHome_Login_OTP`
   - Registered Text: `Your CakeToHome verification code is {#var#}. Valid for 5 minutes. Do not share this with anyone. - CakeToHome India Pvt Ltd`

---

## 2. Recommended SMS Providers

| Provider | India Delivery Latency | Cost per SMS | Supabase Native Support | Operational Verdict |
| :--- | :---: | :---: | :---: | :--- |
| **Twilio Verify** | < 3 sec | ~₹0.80 - ₹1.20 | Native (Dashboard click) | Recommended for global + domestic fallback |
| **Fast2SMS (Quick SMS API)**| < 2 sec | ~₹0.15 - ₹0.25 | Webhook / Custom | Lowest cost domestic Indian routing |
| **MSG91** | < 2 sec | ~₹0.20 - ₹0.30 | Native Supabase integration | Excellent DLT template management |
| **Exotel** | < 3 sec | ~₹0.25 | Custom API adapter | Enterprise Indian telephony provider |

---

## 3. Supabase Dashboard Setup (Twilio Native)

1. Open Supabase Dashboard $\rightarrow$ **Project Settings** $\rightarrow$ **Authentication**.
2. Scroll to **Phone Provider** and toggle to **Enabled**.
3. Under **SMS Provider**, select **Twilio**.
4. Enter credentials:
   - `Account SID`: Formally issued by Twilio console.
   - `Auth Token`: Formally issued by Twilio console.
   - `Twilio Phone Number` / `Verify Service SID`: Registered alphanumeric sender ID.
5. Set **OTP Length**: `6 digits`.
6. Set **OTP Expiry**: `300 seconds (5 minutes)`.
7. Click **Save Changes**.

---

## 4. Current Status & Pending Step

- **Application Integration**: Complete and verified (E.164 normalization, rate-limiting, retry defense, session restore).
- **Provider Status**: **EXTERNAL CONFIGURATION PENDING**. Real SMS delivery requires the designated company officer to insert verified Twilio/MSG91 DLT credentials into the production Supabase console.
- **Fail-Closed Safeguard**: The system will never fabricate delivery or simulate synthetic production OTP delivery.
