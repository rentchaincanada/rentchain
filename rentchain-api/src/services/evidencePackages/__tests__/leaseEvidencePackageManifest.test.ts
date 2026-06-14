import { describe, expect, it } from "vitest";
import {
  buildLeaseEvidencePackageManifest,
  buildLeaseEvidencePackageVerificationMetadata,
  canonicalizeJson,
  hashLeaseEvidencePackageManifest,
} from "../leaseEvidencePackageManifest";
import type { LeaseEvidencePackage } from "../leaseEvidencePackageTypes";

function packageFixture(overrides: Partial<LeaseEvidencePackage> = {}): LeaseEvidencePackage {
  const base: LeaseEvidencePackage = {
    title: "Lease Evidence Package",
    subtitle: "Coburg Rd · Unit 6",
    governance: {
      evidencePackageId: "lep_test_package",
      generatedBy: "landlord-actor-1",
      generatedAt: "2026-06-14T12:00:00.000Z",
      leaseId: "lease-1",
      landlordId: "landlord-1",
      packageType: "lease_evidence_pdf",
      sourceReferences: [
        { sourceCollection: "leases", sourceReference: "leases:internal-lease-token" },
        { sourceCollection: "messages", sourceReference: "messages:internal-message-token" },
        { sourceCollection: "canonicalEvents", sourceReference: "canonicalEvents:internal-event-token" },
      ],
      auditReferences: [
        { sourceCollection: "canonicalEvents", sourceReference: "canonicalEvents:internal-event-token" },
      ],
      sectionsIncluded: ["cover_summary", "messages", "audit_trail"],
    },
    sections: [
      {
        key: "cover_summary",
        title: "Cover Summary",
        emptyState: "No cover summary details were available.",
        items: [
          {
            label: "Evidence package generated",
            description: "Internal note must not affect the manifest.",
            timestamp: "2026-06-14T12:00:00.000Z",
            sourceCollection: "leases",
            sourceReference: "leases:internal-lease-token",
          },
        ],
      },
      {
        key: "messages",
        title: "Messages",
        emptyState: "No landlord-visible messages were available.",
        items: [
          {
            label: "Message from tenant",
            description: "Private message body excerpt with gs://private/path and pi_secret_123.",
            timestamp: "2026-06-14T12:01:00.000Z",
            sourceCollection: "messages",
            sourceReference: "messages:internal-message-token",
          },
        ],
      },
      {
        key: "audit_trail",
        title: "Audit Trail",
        emptyState: "No canonical audit events were available.",
        items: [
          {
            label: "lease.created",
            description: "Audit event metadata.",
            timestamp: "2026-06-14T12:02:00.000Z",
            sourceCollection: "canonicalEvents",
            sourceReference: "canonicalEvents:internal-event-token",
          },
        ],
      },
    ],
  };
  return {
    ...base,
    ...overrides,
    governance: { ...base.governance, ...overrides.governance },
    sections: overrides.sections || base.sections,
  };
}

describe("lease evidence package manifest", () => {
  it("hashes the same manifest input deterministically", () => {
    const manifest = buildLeaseEvidencePackageManifest(packageFixture());
    const first = hashLeaseEvidencePackageManifest(manifest);
    const second = hashLeaseEvidencePackageManifest(buildLeaseEvidencePackageManifest(packageFixture()));

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it("keeps source ordering from changing the manifest hash", () => {
    const first = packageFixture();
    const second = packageFixture({
      governance: {
        ...first.governance,
        sourceReferences: [...first.governance.sourceReferences].reverse(),
        sectionsIncluded: [...first.governance.sectionsIncluded].reverse(),
      },
      sections: [...first.sections].reverse().map((section) => ({
        ...section,
        items: [...section.items].reverse(),
      })),
    });

    expect(hashLeaseEvidencePackageManifest(buildLeaseEvidencePackageManifest(second))).toBe(
      hashLeaseEvidencePackageManifest(buildLeaseEvidencePackageManifest(first))
    );
  });

  it("changes the hash when the safe source summary changes", () => {
    const first = packageFixture();
    const second = packageFixture({
      governance: {
        ...first.governance,
        sourceReferences: [
          ...first.governance.sourceReferences,
          { sourceCollection: "payments", sourceReference: "payments:internal-payment-token" },
        ],
      },
      sections: [
        ...first.sections,
        {
          key: "payments",
          title: "Payments",
          emptyState: "No lease payment records were available.",
          items: [
            {
              label: "Payment recorded",
              description: "Payment summary.",
              timestamp: "2026-06-14T12:03:00.000Z",
              sourceCollection: "payments",
              sourceReference: "payments:internal-payment-token",
            },
          ],
        },
      ],
    });

    expect(hashLeaseEvidencePackageManifest(buildLeaseEvidencePackageManifest(second))).not.toBe(
      hashLeaseEvidencePackageManifest(buildLeaseEvidencePackageManifest(first))
    );
  });

  it("excludes unsafe fields from manifest JSON and verification metadata", () => {
    const pkg = packageFixture();
    const manifestJson = canonicalizeJson(buildLeaseEvidencePackageManifest(pkg));
    const verificationJson = JSON.stringify(buildLeaseEvidencePackageVerificationMetadata(pkg));

    for (const unsafe of [
      "Private message body",
      "gs://private/path",
      "pi_secret_123",
      "leases:internal-lease-token",
      "messages:internal-message-token",
      "canonicalEvents:internal-event-token",
      "provider_secret_request",
      "dropbox_sign",
      "storagePath",
    ]) {
      expect(manifestJson).not.toContain(unsafe);
      expect(verificationJson).not.toContain(unsafe);
    }

    expect(manifestJson).toContain("sourceCountsByCollection");
    expect(verificationJson).toContain("manifestHash");
  });
});
