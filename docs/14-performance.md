# 14 — Performance Targets & SLAs

## Performance Benchmarks & SLAs

| Metric / Endpoint Target | Maximum Target SLA | Target P95 Latency | Benchmark Standard |
| :--- | :--- | :--- | :--- |
| **Catalog Search & PDP (`GET /products`)** | $< 50\text{ ms}$ | $< 30\text{ ms}$ | Redis Cached Response |
| **OTP Verification (`POST /auth/otp/verify`)** | $< 100\text{ ms}$ | $< 60\text{ ms}$ | HMAC Compare + JWT Issue |
| **Order Placement (`POST /orders`)** | $< 200\text{ ms}$ | $< 150\text{ ms}$ | Atomic Row Lock Transaction |
| **KDS Live Board Sync (`GET /branches/:id/kds`)** | $< 100\text{ ms}$ | $< 50\text{ ms}$ | Indexed Query |
| **Throughput Target** | $> 1,500\text{ req/sec}$ | Concurrent API Server Load | Cluster Scaled Node.js |
