// src/state/demoTenantLedger.ts

export interface LedgerEvent {
  id: string;
  tenantId: string;
  type: "payment" | "ai-insight" | "notice" | "maintenance" | "lease";
  timestamp: string; // ISO string
  amount?: number;
  metadata?: any;
  description: string;
}

export const demoTenantLedger: LedgerEvent[] = [
  // Alice (t1)
  {
    id: "evt-001",
    tenantId: "t1",
    type: "payment",
    timestamp: "2025-02-02T12:45:00Z",
    amount: 1500,
    description: "Rent payment received",
  },
  {
    id: "evt-002",
    tenantId: "t1",
    type: "ai-insight",
    timestamp: "2025-02-02T12:46:10Z",
    metadata: {
      sentiment: "stable",
      risk: "Low",
    },
    description: "AI insight: payment pattern stable, low delinquency risk",
  },
  {
    id: "evt-003",
    tenantId: "t1",
    type: "payment",
    timestamp: "2025-01-02T12:40:00Z",
    amount: 1500,
    description: "Rent payment received",
  },
  {
    id: "evt-004",
    tenantId: "t1",
    type: "maintenance",
    timestamp: "2024-12-10T10:00:00Z",
    description: "Maintenance ticket opened: leaking faucet in kitchen",
  },
  {
    id: "evt-005",
    tenantId: "t1",
    type: "lease",
    timestamp: "2024-09-01T15:00:00Z",
    description: "Lease renewed for 12 months at $1,500",
  },

  // Brian (t2)
  {
    id: "evt-101",
    tenantId: "t2",
    type: "payment",
    timestamp: "2025-02-01T13:15:00Z",
    amount: 1650,
    description: "Rent payment received",
  },
  {
    id: "evt-102",
    tenantId: "t2",
    type: "notice",
    timestamp: "2025-01-20T09:30:00Z",
    description:
      "Tenant emailed: temporary cash-flow issue, requested split payment plan",
  },
  {
    id: "evt-103",
    tenantId: "t2",
    type: "payment",
    timestamp: "2025-01-25T18:05:00Z",
    amount: 325,
    description: "Partial payment received",
  },
  {
    id: "evt-104",
    tenantId: "t2",
    type: "lease",
    timestamp: "2024-06-01T14:00:00Z",
    description: "New lease signed: Downtown Lofts · Unit 204",
  },

  // Carmen (t3)
  {
    id: "evt-201",
    tenantId: "t3",
    type: "payment",
    timestamp: "2025-02-03T15:20:00Z",
    amount: 1800,
    description: "Rent payment received 2 days late",
  },
  {
    id: "evt-202",
    tenantId: "t3",
    type: "ai-insight",
    timestamp: "2025-02-03T15:25:30Z",
    metadata: {
      sentiment: "watch",
      risk: "Medium",
    },
    description:
      "AI insight: recurring late payments detected, monitor risk level",
  },
  {
    id: "evt-203",
    tenantId: "t3",
    type: "notice",
    timestamp: "2025-01-15T11:00:00Z",
    description: "N4 notice drafted (not yet served)",
  },
  {
    id: "evt-204",
    tenantId: "t3",
    type: "maintenance",
    timestamp: "2024-11-05T16:10:00Z",
    description: "Work order completed: baseboard heater replaced",
  },
];
