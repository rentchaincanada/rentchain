import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function buildQuery(collectionName: string, predicates: Array<{ field: string; value: any }> = []) {
    return {
      where: (field: string, _op: string, value: any) => buildQuery(collectionName, [...predicates, { field, value }]),
      get: async () => {
        const docs = Array.from(ensureCollection(collectionName).values())
          .filter((entry) => predicates.every((predicate) => entry.data?.[predicate.field] === predicate.value))
          .map((entry) => ({
            id: entry.id,
            data: () => entry.data,
          }));
        return { docs, empty: docs.length === 0 };
      },
    };
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => buildQuery(name).where(field, op, value),
      }),
    },
    resetDb: () => collections.clear(),
    seedDoc: (collectionName: string, id: string, data: any) => {
      ensureCollection(collectionName).set(id, { id, data });
    },
  };
});

vi.mock("../../../firebase", () => ({
  db: dbMock,
}));

function partialProgress(overrides?: Partial<any>) {
  return {
    status: "in_progress",
    completionPercent: 60,
    currentStep: "employment",
    completedSections: ["personal_info", "residential_history"],
    missingSections: ["employment", "references_assets", "consent"],
    hasCoApplicant: false,
    viewingChoice: "already_viewed",
    startedAt: 1_700_000_000_000,
    lastActivityAt: 1_700_000_600_000,
    submittedAt: null,
    reminderEligibleAt: 1_700_000_000_000,
    reminderSentAt: null,
    ...overrides,
  };
}

describe("loadLandlordApplicationFunnel", () => {
  beforeEach(() => {
    resetDb();
  });

  it("aggregates active partials and submitted applications into funnel metrics", async () => {
    seedDoc("applicationLinks", "link-started", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      partialProgress: partialProgress({
        status: "started",
        completionPercent: 20,
        currentStep: "personal_info",
        missingSections: ["personal_info", "employment"],
      }),
    });
    seedDoc("applicationLinks", "link-progress", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      partialProgress: partialProgress({
        status: "in_progress",
        completionPercent: 60,
        currentStep: "employment",
        missingSections: ["employment", "references_assets"],
        reminderSentAt: 1_700_000_100_000,
      }),
    });
    seedDoc("applicationLinks", "link-ready", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      partialProgress: partialProgress({
        status: "ready_to_submit",
        completionPercent: 90,
        currentStep: "consent",
        missingSections: ["consent"],
      }),
    });
    seedDoc("applicationLinks", "link-submitted", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      partialProgress: partialProgress({
        status: "submitted",
        completionPercent: 100,
        currentStep: null,
        missingSections: [],
        submittedAt: 1_700_002_000_000,
        reminderSentAt: 1_700_001_000_000,
      }),
    });
    seedDoc("rentalApplications", "app-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      submittedAt: 1_700_001_720_000,
      applicationLinkId: "link-submitted",
    });

    const { loadLandlordApplicationFunnel } = await import("../landlordApplicationFunnel");
    const result = await loadLandlordApplicationFunnel({
      landlordId: "landlord-1",
      propertyId: "prop-1",
    });

    expect(result.counts).toEqual({
      started: 1,
      inProgress: 1,
      readyToSubmit: 1,
      submitted: 1,
      totalStarted: 4,
    });
    expect(result.conversion.completionRate).toBe(0.25);
    expect(result.conversion.averageCompletionPercent).toBe(67.5);
    expect(result.dropOff.byCurrentStep).toEqual([
      { step: "consent", count: 1 },
      { step: "employment", count: 1 },
      { step: "personal_info", count: 1 },
    ]);
    expect(result.dropOff.byMissingSection).toEqual([
      { section: "employment", count: 2 },
      { section: "consent", count: 1 },
      { section: "personal_info", count: 1 },
      { section: "references_assets", count: 1 },
    ]);
    expect(result.reminders).toEqual({
      remindedCount: 2,
      completedAfterReminderCount: 1,
      completionRateAfterReminder: 0.5,
      medianHoursToCompleteAfterReminder: 0.2,
    });
  });

  it("returns a stable empty-state payload with no records", async () => {
    const { loadLandlordApplicationFunnel } = await import("../landlordApplicationFunnel");
    const result = await loadLandlordApplicationFunnel({
      landlordId: "landlord-empty",
    });

    expect(result).toEqual({
      counts: {
        started: 0,
        inProgress: 0,
        readyToSubmit: 0,
        submitted: 0,
        totalStarted: 0,
      },
      conversion: {
        completionRate: 0,
        averageCompletionPercent: 0,
      },
      dropOff: {
        byCurrentStep: [],
        byMissingSection: [],
      },
      reminders: {
        remindedCount: 0,
        completedAfterReminderCount: 0,
        completionRateAfterReminder: null,
        medianHoursToCompleteAfterReminder: null,
      },
    });
  });
});
