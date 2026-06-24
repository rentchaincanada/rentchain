import { describe, expect, it } from "vitest";
import {
  buildPropertyManagerCompanyPreviewFixture,
  buildPropertyManagerCompanyPreviewFixtureSafeSummary,
  stablePreviewFixtureId,
} from "../propertyManagerCompanyPreviewFixturePlan";

describe("propertyManagerCompanyPreviewFixturePlan", () => {
  it("builds deterministic active QA company and admin membership records", () => {
    const first = buildPropertyManagerCompanyPreviewFixture({
      fixtureKey: "pm-company-preview-qa-v1",
      companyLabel: "Acme Property Management QA",
      userId: "qa-user-internal",
      userEmail: "pm-admin@example.test",
      role: "company_admin",
      now: "2026-06-24T12:00:00.000Z",
    });
    const second = buildPropertyManagerCompanyPreviewFixture({
      fixtureKey: "pm-company-preview-qa-v1",
      companyLabel: "Acme Property Management QA",
      userId: "qa-user-internal",
      userEmail: "pm-admin@example.test",
      role: "company_admin",
      now: "2026-06-24T12:00:00.000Z",
    });

    expect(first.company.companyId).toBe(second.company.companyId);
    expect(first.membership.membershipId).toBe(second.membership.membershipId);
    expect(first.company).toMatchObject({
      companyName: "Acme Property Management QA",
      safeDisplayLabel: "Acme Property Management QA",
      status: "active",
      qaFixture: true,
      qaFixtureKey: "pm-company-preview-qa-v1",
    });
    expect(first.membership).toMatchObject({
      role: "company_admin",
      status: "active",
      safeDisplayLabel: "pm-admin@example.test",
      qaFixture: true,
      qaFixtureKey: "pm-company-preview-qa-v1",
    });
  });

  it("supports a governed suspend cleanup mode without hard-delete semantics", () => {
    const fixture = buildPropertyManagerCompanyPreviewFixture({
      fixtureKey: "pm-company-preview-qa-v1",
      companyLabel: "Acme Property Management QA",
      userId: "qa-user-internal",
      userEmail: "pm-admin@example.test",
      role: "company_owner",
      now: "2026-06-24T12:00:00.000Z",
      mode: "suspend",
    });

    expect(fixture.company.status).toBe("archived");
    expect(fixture.membership.status).toBe("removed");
    expect(fixture.membership.removedAt).toBe("2026-06-24T12:00:00.000Z");
    expect(fixture.membership.removedByUserId).toBe("qa-user-internal");
  });

  it("rejects ordinary staff roles for the admin fixture membership", () => {
    expect(() =>
      buildPropertyManagerCompanyPreviewFixture({
        fixtureKey: "pm-company-preview-qa-v1",
        companyLabel: "Acme Property Management QA",
        userId: "qa-user-internal",
        userEmail: "pm-admin@example.test",
        role: "property_manager",
      } as any)
    ).toThrow("qa_fixture_company_admin_or_owner_required");
  });

  it("safe summaries report labels and statuses without exposing raw IDs", () => {
    const fixture = buildPropertyManagerCompanyPreviewFixture({
      fixtureKey: "pm-company-preview-qa-v1",
      companyLabel: "Acme Property Management QA",
      userId: "qa-user-internal",
      userEmail: "pm-admin@example.test",
      role: "company_admin",
      now: "2026-06-24T12:00:00.000Z",
    });
    const summary = buildPropertyManagerCompanyPreviewFixtureSafeSummary({
      mode: "upsert",
      write: false,
      company: fixture.company,
      membership: fixture.membership,
      companyExists: false,
      membershipExists: true,
    });

    expect(summary).toMatchObject({
      mode: "dry-run",
      fixtureMode: "upsert",
      company: {
        action: "create",
        label: "Acme Property Management QA",
        status: "active",
      },
      membership: {
        action: "update",
        staffLabel: "pm-admin@example.test",
        role: "company_admin",
        status: "active",
      },
      rawIdsPrinted: false,
    });
    expect(JSON.stringify(summary)).not.toContain(fixture.company.companyId);
    expect(JSON.stringify(summary)).not.toContain(fixture.membership.membershipId);
    expect(stablePreviewFixtureId("pm_company_qa", ["pm-company-preview-qa-v1"])).toBe(fixture.company.companyId);
  });
});
