import type { AutomationEvent } from "./automationTimeline.types";

const minute = 60 * 1000;
const hour = 60 * minute;

const iso = (ms: number) => new Date(ms).toISOString();

export function getMockAutomationEvents(): AutomationEvent[] {
  const now = Date.now();

  return [
    {
      id: "evt-system-init",
      type: "SYSTEM",
      occurredAt: iso(now - 15 * minute),
      title: "Timeline initialized",
      summary: "Automation Timeline shell is active for this workspace.",
      metadata: { source: "mock", note: "v1.1 timeline bootstrap event" },
    },
    {
      id: "evt-property-added",
      type: "PROPERTY",
      occurredAt: iso(now - 45 * minute),
      title: "Property added",
      summary: "A new property was added to the portfolio.",
      entity: { propertyId: "prop_102" },
      metadata: { source: "mock", note: "portfolio setup action" },
    },
    {
      id: "evt-tenant-invited",
      type: "TENANT",
      occurredAt: iso(now - 2 * hour),
      title: "Tenant invited",
      summary: "Invite link was created and sent to prospective tenant.",
      entity: { propertyId: "prop_102", unitId: "unit_3b", tenantId: "ten_4401" },
      metadata: { source: "mock", note: "invite pipeline sample" },
    },
    {
      id: "evt-screening-complete",
      type: "SCREENING",
      occurredAt: iso(now - 5 * hour),
      title: "Screening completed",
      summary: "Screening report is available for review.",
      entity: { tenantId: "ten_4401", applicationId: "app_22008" },
      metadata: { source: "mock", note: "screening workflow sample" },
    },
    {
      id: "evt-lease-generated",
      type: "LEASE",
      occurredAt: iso(now - 9 * hour),
      title: "Lease generated",
      summary: "Lease pack draft generated from tenant profile.",
      entity: {
        propertyId: "prop_102",
        unitId: "unit_3b",
        tenantId: "ten_4401",
        leaseId: "lease_9922",
      },
      metadata: { source: "mock", note: "lease pack automation sample" },
    },
    {
      id: "evt-rent-payment",
      type: "PAYMENT",
      occurredAt: iso(now - 14 * hour),
      title: "Rent payment recorded",
      summary: "Monthly rent payment was captured and posted.",
      entity: { tenantId: "ten_4401", leaseId: "lease_9922", paymentId: "pay_55672" },
      metadata: { source: "mock", note: "payments ledger sample" },
    },
    {
      id: "evt-message-thread",
      type: "MESSAGE",
      occurredAt: iso(now - 20 * hour),
      title: "Tenant message received",
      summary: "New message in conversation thread regarding move-in details.",
      entity: { tenantId: "ten_4401", propertyId: "prop_102" },
      metadata: { source: "mock", note: "communications sample" },
    },
    {
      id: "evt-system-check",
      type: "SYSTEM",
      occurredAt: iso(now - 28 * hour),
      title: "Rule audit completed",
      summary: "Compliance checks ran with no blocking issues.",
      metadata: { source: "mock", note: "compliance audit sample" },
    },
  ];
}
