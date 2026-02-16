export type TenantStatus = "active" | "pending" | "vacated";
export type PropertyStatus = "draft" | "active";
export type UnitStatus = "vacant" | "occupied";
export type LedgerEventType =
  | "payment_created"
  | "payment_updated"
  | "payment_deleted"
  | "charge_created";
export type ScreeningProvider = "mock" | "singlekey" | "providerA" | "stubbed_screening";
export type ScreeningStatus = "requested" | "paid" | "completed" | "failed" | "queued";
export type PaymentMethod = "manual" | "cash" | "e-transfer" | "cheque" | "card" | string;
export interface PortfolioSnapshot {
  propertyCount: number;
  unitCount: number;
  occupiedUnits: number;
  occupancyPct: number;
  overdueTenants: number;
  totalMonthlyRent: number;
  ledgerAnomalies: string[];
}

export interface PortfolioAiSummary {
  healthLabel: "Excellent" | "Stable" | "At Risk";
  summaryText: string;
  risks: string[];
  opportunities: string[];
  suggestedActions: string[];
}

export type MaintenanceIssueType =
  | "no_heat"
  | "no_hot_water"
  | "water_leak"
  | "electrical"
  | "snow_ice"
  | "lighting"
  | "security"
  | "noise"
  | "other";

export type IssueSeverity = "low" | "medium" | "urgent";

export type ActionRequestStatus = "new" | "acknowledged" | "resolved";

export interface PropertyActionRequest {
  id: string;
  landlordId: string;
  propertyId: string;
  unitId?: string;
  tenantId?: string;
  source: "tenant" | "landlord";
  issueType: MaintenanceIssueType;
  severity: IssueSeverity;
  location: "unit" | "building";
  description: string;
  status: ActionRequestStatus;
  reportedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Landlord {
  id: string;
  email: string;
  createdAt?: string;
}

export interface Tenant {
  id: string;
  landlordId?: string;
  fullName?: string;
  status?: TenantStatus;
  monthlyRent?: number;
  propertyId?: string;
  unitId?: string;
  createdAt?: string;
}

export interface Property {
  id: string;
  landlordId: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country?: string;
  status?: PropertyStatus;
  totalUnits?: number;
  createdAt?: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  status: UnitStatus;
  rent?: number;
}

export interface Payment {
  id: string;
  tenantId: string;
  landlordId?: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  notes?: string | null;
  propertyId?: string | null;
}

export interface LedgerEvent {
  id: string;
  landlordId?: string;
  tenantId: string;
  type: LedgerEventType;
  amountDelta: number;
  occurredAt: string;
  reference?: {
    kind: string;
    id: string;
  };
  method?: string | null;
  notes?: string | null;
}

export interface Screening {
  id: string;
  landlordId: string;
  applicationId?: string;
  providerName?: ScreeningProvider;
  status: ScreeningStatus;
  priceCents?: number;
  currency?: string;
  createdAt: string;
  paidAt?: string;
  completedAt?: string;
  failureReason?: string;
}

export type ReputationTimelineEventType =
  | "payment"
  | "charge"
  | "screening"
  | "maintenance_reported"
  | "action_acknowledged"
  | "action_resolved";

export interface ReputationTimelineEvent {
  id: string;
  landlordId: string;
  tenantId: string;
  propertyId?: string;
  unitId?: string;
  type: ReputationTimelineEventType;
  title: string;
  detail?: string;
  occurredAt: string;
  meta?: Record<string, unknown>;
}
