# ADR-005: Event-Driven Architecture & Outbox Pattern

## Status
Accepted

## Decision
Use an in-process EventEmitter for sync domain events (`OrderCreated`, `InventoryReserved`) and Redis Pub/Sub / BullMQ for async decoupled events (KDS notifications, SMS dispatch).
