import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
    return collections.get(name)!;
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id || `${name}_${++autoId}`;
        return {
          id: docId,
          get: async () => ({
            id: docId,
            exists: ensureCollection(name).has(docId),
            data: () => ensureCollection(name).get(docId),
          }),
          set: async (value: any) => {
            ensureCollection(name).set(docId, value);
          },
        };
      },
    }),
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        set(ref: any, value: any) {
          ops.push(() => ref.set(value));
        },
        async commit() {
          for (const op of ops) {
            await op();
          }
        },
      };
    },
  };

  return { collections, dbMock };
});

vi.mock("../../firebase", () => ({
  db: dbMock,
}));

vi.mock("../../email/templates/baseEmailTemplate", () => ({
  buildEmailHtml: vi.fn(),
  buildEmailText: vi.fn(),
}));

const sendEmail = vi.fn();
vi.mock("../emailService", () => ({
  sendEmail,
}));

describe("saveRenewalNoticeDraftSnapshot", () => {
  beforeEach(() => {
    collections.clear();
    vi.clearAllMocks();
  });

  it("persists a draft snapshot, legacy audit event, and landlord-visible canonical event without delivery flags", async () => {
    const { saveRenewalNoticeDraftSnapshot } = await import("../leaseNoticeWorkflowService");

    const result = await saveRenewalNoticeDraftSnapshot({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      actorId: "landlord-1",
      actorEmail: "manager@example.com",
      lease: {
        id: "lease-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        propertyId: "property-1",
        unitId: "unit-1",
        status: "active",
        leaseType: "fixed_term",
        province: "NS",
        leaseStartDate: "2026-01-01",
        leaseEndDate: "2026-12-31",
        currentRent: 1850,
        currency: "CAD",
        autoNoticeEnabled: false,
        noticeRuleVersion: null,
        noticeLeadDays: null,
        nextNoticeDueAt: null,
        latestNoticeId: null,
        latestRenewalIntent: null,
        latestRenewalIntentAt: null,
        renewalRentChangeMode: "increase",
        renewalOfferedRent: 1975,
        renewalDecisionDeadlineAt: Date.UTC(2026, 10, 15),
        renewalNewTermType: "fixed_term",
        renewalNewLeaseStartDate: "2027-01-01",
        renewalNewLeaseEndDate: "2027-12-31",
        moveOutDate: null,
        createdAt: 1,
        updatedAt: 1,
        tenantName: "Jane Tenant",
        unitLabel: "Unit 101",
        propertyLabel: "Harbour View",
        propertyAddress: "12 Harbour Road",
        jurisdictionWorkflow: null,
      },
      input: {
        draftText: "Hello Jane,\n\nThis is a renewal planning draft.",
        generatedAt: "2026-07-11T11:59:00.000Z",
        sourceValues: {
          tenantLabel: "Jane Tenant",
          propertyUnitLabel: "Harbour View · Unit 101",
          currentRentLabel: "CA$1,850.00",
          renewalRentLabel: "CA$1,975.00",
          currentLeaseEndLabel: "December 31, 2026",
          proposedTermLabel: "Fixed term · January 1, 2027 to December 31, 2027",
          tenantResponseTargetDateLabel: "November 15, 2026",
        },
        noDeliveryFlags: {
          emailSent: false,
          noticeServed: false,
          tenantNotified: false,
        },
      },
    });

    expect(result.ok).toBe(true);
    const snapshots = Array.from((collections.get("renewalNoticeDraftSnapshots") || new Map()).values());
    const events = Array.from((collections.get("events") || new Map()).values());
    const canonicalEvents = Array.from((collections.get("canonicalEvents") || new Map()).values());
    expect(snapshots).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(canonicalEvents).toHaveLength(1);
    expect(snapshots[0]).toEqual(
      expect.objectContaining({
        leaseId: "lease-1",
        landlordId: "landlord-1",
        source: "renewal_notice_draft",
        status: "draft_saved",
        emailSent: false,
        noticeServed: false,
        tenantNotified: false,
        generatedDraftText: expect.stringContaining("renewal planning draft"),
      })
    );
    expect(events[0]).toEqual(
      expect.objectContaining({
        type: "renewal_notice_draft_saved",
        leaseId: "lease-1",
        summary: "Renewal notice draft saved. Not sent, not served, tenant not notified.",
      })
    );
    expect(canonicalEvents[0]).toEqual(
      expect.objectContaining({
        type: "renewal_notice_draft_saved",
        visibility: "landlord",
        resource: expect.objectContaining({ type: "lease", id: "lease-1" }),
        metadata: expect.objectContaining({
          noDelivery: true,
          flags: { emailSent: false, noticeServed: false, tenantNotified: false },
        }),
      })
    );
    expect(sendEmail).not.toHaveBeenCalled();
    expect(collections.get("leaseNotices")).toBeUndefined();
  });

  it("rejects payloads that try to claim delivery state", async () => {
    const { saveRenewalNoticeDraftSnapshot } = await import("../leaseNoticeWorkflowService");

    const result = await saveRenewalNoticeDraftSnapshot({
      leaseId: "lease-1",
      landlordId: "landlord-1",
      lease: {} as any,
      input: {
        draftText: "Draft text",
        sourceValues: {
          tenantLabel: "Jane Tenant",
          propertyUnitLabel: "Harbour View · Unit 101",
          currentRentLabel: "CA$1,850.00",
          renewalRentLabel: "CA$1,975.00",
          currentLeaseEndLabel: "December 31, 2026",
          proposedTermLabel: "Fixed term · January 1, 2027 to December 31, 2027",
          tenantResponseTargetDateLabel: "November 15, 2026",
        },
        noDeliveryFlags: {
          emailSent: true,
          noticeServed: false,
          tenantNotified: false,
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: 400,
        error: "DRAFT_SNAPSHOT_DELIVERY_FLAGS_INVALID",
      })
    );
    expect(collections.get("renewalNoticeDraftSnapshots")).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
