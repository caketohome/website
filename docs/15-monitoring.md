# 15 — Monitoring & Telemetry

## Operational Telemetry Stack

* **Health Endpoints**: `/health` returning JSON database connection state, Redis health, and uptime.
* **Metrics**: Prometheus metrics exported at `/metrics` (request duration histograms, HTTP 5xx error counter, active WebSocket connections).
* **Error Tracking**: Centralized exception logging via Sentry / Structured Logger.
