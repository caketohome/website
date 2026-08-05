# 12 — Environment Variables Dictionary

| Variable Name | Required | Default | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Yes | `9000` | HTTP Express server port | `9000` |
| `NODE_ENV` | Yes | `development` | Runtime mode (`development`, `production`, `test`) | `production` |
| `DATABASE_URL` | Yes | N/A | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/caketohome` |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection URL | `redis://localhost:6379` |
| `JWT_SECRET` | Yes | N/A | Secret key for signing JWT tokens | `super_secret_jwt_key_2026` |
| `OTP_SECRET` | Yes | N/A | Secret key for HMAC OTP hashing | `super_secret_otp_hmac_2026` |
| `RAZORPAY_KEY_ID` | Optional | N/A | Razorpay live API key ID | `rzp_live_xxx` |
| `RAZORPAY_KEY_SECRET` | Optional | N/A | Razorpay live API secret | `secret_xxx` |
