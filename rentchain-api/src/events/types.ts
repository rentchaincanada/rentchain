// ----------------------------------------
// Core Shared Types
// ----------------------------------------

export type Env = "dev" | "staging" | "prod";

export type ActorType = "tenant" | "landlord" | "system" | "admin";

export interface EventActor {
  actorType: ActorType;
  actorId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface EventContext {
  propertyId?: string | null;
  unitId?: string | null;
  leaseId?: string | null;
  tenantId?: string | null;
  landlordId?: string | null;
  // extend when needed
}

export interface EventIntegrity {
  payloadHash: string;
  previousEventHash?: string | null;
  signature?: string | null;
  signingMethod?: string | null;
  nonce?: number;
}

export interface EventLinks {
  firestoreDocPath?: string | null;
  apiEndpoint?: string | null;
  onChainTxHash?: string | null;
  explorerUrl?: string | null;
}

// ----------------------------------------
// Base Envelope Type
// ----------------------------------------

export interface EventEnvelope<P = unknown> {
  eventId: string;
  eventType: string;
  version: string;
  timestamp: string;
  env: Env;

  actor: EventActor;
  context: EventContext;
  payload: P;
  integrity: EventIntegrity;
  links: EventLinks;
}

// ----------------------------------------
// Identity & Account Payloads
// ----------------------------------------

export interface TenantRegisteredPayload {
  tenantPublicId: string;
  kycStatus: "pending" | "verified" | "rejected";
  emailVerified: boolean;
  phoneVerified: boolean;
  registrationSource: "web" | "mobile" | "agent" | "import";
  referredBy?: string | null;
}

export interface TenantKycVerifiedPayload {
  tenantPublicId: string;
  kycProvider: string;
  kycReferenceId: string;
  kycResult: "verified" | "failed";
  riskScore?: number | null;
}

export interface LandlordRegisteredPayload {
  landlordPublicId: string;
  landlordType: "individual" | "corporation";
  registrationSource: "web" | "mobile" | "agent" | "import";
}

// ----------------------------------------
// Property & Lease Payloads
// ----------------------------------------

export interface PropertyRegisteredPayload {
  propertyPublicId: string;
  country: string;
  province: string;
  city: string;
  unitCount: number;
  managementCompanyId?: string | null;
}

export interface LeaseCreatedPayload {
  leasePublicId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  rentCurrency: string;
  paymentFrequency: "monthly" | "weekly" | "biweekly" | "custom";
  dueDayOfMonth?: number | null;
  securityDepositAmount?: number | null;
  autoReportToCreditBureaus: boolean;
}

export interface LeaseUpdatedPayload {
  leasePublicId: string;
  updatedFields: Record<
    string,
    { old: unknown; new: unknown }
  >;
  effectiveDate: string;
}

export interface LeaseTerminatedPayload {
  leasePublicId: string;
  terminationType: "notice" | "mutual" | "eviction" | "other";
  terminationDate: string;
  reasonCode?: string | null;
}

// ----------------------------------------
// Payment Payloads
// ----------------------------------------

export interface RentPaymentInitiatedPayload {
  paymentPublicId: string;
  leasePublicId: string;
  billingPeriod: string;
  dueDate: string;
  amountDue: number;
  currency: string;
  paymentMethod: "etransfer" | "pad" | "card" | "cash" | "other";
  initiatedBy: "tenant" | "landlord" | "system";
}

export interface RentPaymentRecordedPayload {
  paymentPublicId: string;
  leasePublicId: string;
  billingPeriod: string;
  amountPaid: number;
  currency: string;
  paymentDate: string;
  paymentMethod: "etransfer" | "pad" | "card" | "cash" | "other";
  processor: string;
  processorRef?: string | null;
  status: "pending" | "settled" | "failed";
  lateDays: number;
  lateFeeApplied: number;
  isPartial: boolean;
}

export interface RentPaymentFailedPayload {
  paymentPublicId: string;
  failureReasonCode: "NSF" | "CARD_DECLINED" | "TIMEOUT" | "OTHER";
  retryAvailable: boolean;
  retryAfter?: string | null;
}

// ----------------------------------------
// Credit Reporting Payloads
// ----------------------------------------

export interface RentReportedToBureauPayload {
  reportBatchId: string;
  tenantPublicId: string;
  leasePublicId: string;
  billingPeriod: string;
  amountReported: number;
  status: "submitted" | "accepted" | "rejected";
  bureau: string;
  bureauReferenceId?: string | null;
}

export interface BureauReportResultReceivedPayload {
  reportBatchId: string;
  tenantPublicId: string;
  bureau: string;
  status: "accepted" | "rejected";
  reasonCode?: string | null;
  details?: string | null;
}

// ----------------------------------------
// Maintenance Payloads
// ----------------------------------------

export interface MaintenanceRequestOpenedPayload {
  ticketPublicId: string;
  priority: "low" | "normal" | "high" | "emergency";
  category: string;
  title: string;
  initialStatus: "open" | "in_progress" | "closed";
}

export interface MaintenanceRequestUpdatedStatusPayload {
  ticketPublicId: string;
  oldStatus: string;
  newStatus: string;
  assignedTo?: string | null;
}

// ----------------------------------------
// AI Agent Payloads
// ----------------------------------------

export type AIAgentTaskType =
  | "summarize_maintenance"
  | "classify_issue"
  | "reply_to_tenant"
  | "reply_to_landlord"
  | "route_ticket"
  | "risk_score_tenant"
  | "custom";

export type AIAgentTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed";

export interface AIAgentTaskCreatedPayload {
  taskId: string;
  sourceEventId: string;
  sourceEventType: string;
  taskType: AIAgentTaskType;
  status: AIAgentTaskStatus;        // usually "pending" at creation
  priority: "low" | "normal" | "high";
  inputSummary: string;             // short text description of what the task is about
  tenantPublicId?: string | null;
  landlordPublicId?: string | null;
}

export interface AIAgentTaskCompletedPayload {
  taskId: string;
  sourceEventId: string;
  taskType: AIAgentTaskType;
  status: "completed";
  resultSummary: string;            // short one-line result
  resultDetails?: string;           // optional longer JSON/string
  confidenceScore?: number;         // 0–1
  humanReviewRecommended: boolean;
}

export interface AIAgentTaskFailedPayload {
  taskId: string;
  sourceEventId: string;
  taskType: AIAgentTaskType;
  status: "failed";
  errorCode: string;
  errorMessage: string;
}

// ----------------------------------------
// Event Type Aliases
// ----------------------------------------

export type TenantRegisteredEvent = EventEnvelope<TenantRegisteredPayload>;
export type TenantKycVerifiedEvent = EventEnvelope<TenantKycVerifiedPayload>;
export type LandlordRegisteredEvent = EventEnvelope<LandlordRegisteredPayload>;

export type PropertyRegisteredEvent = EventEnvelope<PropertyRegisteredPayload>;
export type LeaseCreatedEvent = EventEnvelope<LeaseCreatedPayload>;
export type LeaseUpdatedEvent = EventEnvelope<LeaseUpdatedPayload>;
export type LeaseTerminatedEvent = EventEnvelope<LeaseTerminatedPayload>;

export type RentPaymentInitiatedEvent = EventEnvelope<RentPaymentInitiatedPayload>;
export type RentPaymentRecordedEvent = EventEnvelope<RentPaymentRecordedPayload>;
export type RentPaymentFailedEvent = EventEnvelope<RentPaymentFailedPayload>;

export type RentReportedToBureauEvent = EventEnvelope<RentReportedToBureauPayload>;
export type BureauReportResultReceivedEvent = EventEnvelope<BureauReportResultReceivedPayload>;

export type MaintenanceRequestOpenedEvent = EventEnvelope<MaintenanceRequestOpenedPayload>;
export type MaintenanceRequestUpdatedStatusEvent =
  EventEnvelope<MaintenanceRequestUpdatedStatusPayload>;

// AI Agent Events
export type AIAgentTaskCreatedEvent = EventEnvelope<AIAgentTaskCreatedPayload>;
export type AIAgentTaskCompletedEvent = EventEnvelope<AIAgentTaskCompletedPayload>;
export type AIAgentTaskFailedEvent = EventEnvelope<AIAgentTaskFailedPayload>;

