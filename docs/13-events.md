# 13 — Event Architecture & Event Catalog

## Core System Event Flows

```
[ Customer Places Order ] ──► Emits OrderCreated Event
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
Inventory Service             Kitchen KDS Dispatch            Notification Service
(Locks Branch Stock)          (Updates 5-Column Board)        (BullMQ SMS / WhatsApp)
```

## Event Catalog

| Event Name | Producer | Payload Data | Consumers |
| :--- | :--- | :--- | :--- |
| `CustomerRegistered` | AuthModule | `{ customer_id, phone }` | CRMModule, AnalyticsModule |
| `OrderCreated` | OrderModule | `{ order_id, branch_id, total }` | InventoryModule, KDSModule, NotificationModule |
| `OrderStatusUpdated` | KDSModule | `{ order_id, status }` | NotificationModule, AnalyticsModule |
| `StockDepleted` | InventoryModule | `{ branch_id, product_id }` | CatalogModule (Mark OUT_OF_STOCK) |
