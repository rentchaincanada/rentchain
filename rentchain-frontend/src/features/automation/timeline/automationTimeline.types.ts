export type AutomationEventType =
  | "LEASE"
  | "SCREENING"
  | "PAYMENT"
  | "MESSAGE"
  | "PROPERTY"
  | "TENANT"
  | "SYSTEM";

export type AutomationEvent = {
  id: string;
  type: AutomationEventType;
  occurredAt: string; // ISO
  title: string;
  summary?: string;
  entity?: {
    propertyId?: string;
    unitId?: string;
    tenantId?: string;
    applicationId?: string;
    leaseId?: string;
    paymentId?: string;
  };
  metadata?: Record<string, unknown>;
};
