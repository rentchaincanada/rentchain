// src/events/domainEvents.ts

/**
 * High-level domain event types for the unified RentChain event stream.
 *
 * This is intentionally flexible: we define some core ones,
 * but we also allow arbitrary strings for future extension.
 */
export type DomainEventType =
  | "ai.task.requested"
  | "ai.task.completed"
  | "payments.rent.recorded"
  | "payments.rent.late"
  | "tenant.balance.updated"
  | "tenant.created"
  | "tenant.updated"
  | "property.created"
  | "property.updated"
  | string; // allow future event types without breaking TS

/**
 * Base shape for ALL events in the unified stream.
 */
export interface BaseDomainEvent {
  id: string;
  type: DomainEventType;
  timestamp: string; // ISO8601
  source: string; // e.g. "rentchain.api.ai", "rentchain.api.payments"
  // Core optional references:
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  // For blockchain / tracing:
  correlationId?: string; // tie related events together (e.g. AI requested/completed)
  // Flexible buckets for domain-specific info:
  metadata?: Record<string, any>;
  payload?: Record<string, any>;
}

/**
 * Input when recording a domain event via the dispatcher.
 * We allow omitting id / timestamp so the dispatcher can fill them in.
 */
export type DomainEventInput = Omit<BaseDomainEvent, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};
