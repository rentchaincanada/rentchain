import { describe, expect, it } from "vitest";
import { renderLeaseEvidencePackagePdf } from "../leaseEvidencePackagePdf";
import type { LeaseEvidencePackage } from "../leaseEvidencePackageTypes";

function packageFixture(): LeaseEvidencePackage {
  return {
    title: "Lease Evidence Package",
    subtitle: "Oxford Suites · Unit 101",
    governance: {
      evidencePackageId: "lep_test_package",
      generatedBy: "landlord-1",
      generatedAt: "2026-06-14T12:00:00.000Z",
      leaseId: "lease-1",
      landlordId: "landlord-1",
      packageType: "lease_evidence_pdf",
      sectionsIncluded: [
        "cover_summary",
        "lease_information",
        "parties",
        "timeline",
        "documents",
        "messages",
        "payments",
        "maintenance_events",
        "notices",
        "signature_events",
        "audit_trail",
      ],
      verification: {
        manifestVersion: "lease_evidence_manifest_v1",
        hashAlgorithm: "sha256",
        manifestHash: "a".repeat(64),
        packageVersion: "lease-evidence-package-pdf-v1",
        evidencePackageId: "lep_test_package",
        generatedAt: "2026-06-14T12:00:00.000Z",
        sourceReferenceCount: 4,
        sourceCollections: ["canonicalEvents", "leaseSigningRequests", "leases", "messages"],
        sectionSourceCounts: [
          { sectionKey: "cover_summary", itemCount: 1, sourceCollections: ["leases"] },
          { sectionKey: "messages", itemCount: 1, sourceCollections: ["messages"] },
          { sectionKey: "payments", itemCount: 1, sourceCollections: ["ledgerEntries"] },
          { sectionKey: "signature_events", itemCount: 1, sourceCollections: ["leaseSigningRequests"] },
          { sectionKey: "audit_trail", itemCount: 1, sourceCollections: ["canonicalEvents"] },
        ],
      },
      sourceReferences: [
        { sourceCollection: "leases", sourceReference: "leases:c46d6f2b5e6a8d17d240" },
        { sourceCollection: "messages", sourceReference: "messages:097bc6c0f4e698e3fb27" },
        { sourceCollection: "canonicalEvents", sourceReference: "canonicalEvents:8eac2421de1779603d6d" },
        { sourceCollection: "leaseSigningRequests", sourceReference: "leaseSigningRequests:f4f62abf663d03c38f92" },
      ],
      auditReferences: [
        { sourceCollection: "canonicalEvents", sourceReference: "canonicalEvents:8eac2421de1779603d6d" },
      ],
    },
    sections: [
      {
        key: "cover_summary",
        title: "Cover Summary",
        emptyState: "No cover summary details were available.",
        items: [
          {
            label: "Evidence package generated",
            description: "Evidence package generated for manual review.",
            timestamp: "2026-06-14T12:00:00.000Z",
            sourceCollection: "leases",
            sourceReference: "leases:c46d6f2b5e6a8d17d240",
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
            description: "Message body excerpt.",
            timestamp: "2026-06-14T12:01:00.000Z",
            sourceCollection: "messages",
            sourceReference: "messages:097bc6c0f4e698e3fb27",
          },
        ],
      },
      {
        key: "payments",
        title: "Payments",
        emptyState: "No lease payment records were available.",
        items: [
          {
            label: "Payment recorded",
            description: "$1800.00 via etransfer.",
            timestamp: "2026-06-14T12:02:00.000Z",
            sourceCollection: "ledgerEntries",
            sourceReference: "ledgerEntries:1234567890abcdef1234",
          },
        ],
      },
      {
        key: "signature_events",
        title: "Signature Events",
        emptyState: "No signature events were available.",
        items: [
          {
            label: "Signing request created",
            description: "Dispatch status recorded.",
            timestamp: "2026-06-14T12:03:00.000Z",
            sourceCollection: "leaseSigningRequests",
            sourceReference: "leaseSigningRequests:f4f62abf663d03c38f92",
          },
        ],
      },
      {
        key: "audit_trail",
        title: "Audit Trail",
        emptyState: "No canonical audit events were available.",
        items: [
          {
            label: "evidence_package_generated",
            description: "Audit event metadata.",
            timestamp: "2026-06-14T12:04:00.000Z",
            sourceCollection: "canonicalEvents",
            sourceReference: "canonicalEvents:8eac2421de1779603d6d",
          },
        ],
      },
    ],
  };
}

function decodedPdfText(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const chunks: string[] = [];
  for (const match of raw.matchAll(/<([0-9a-fA-F]+)>/g)) {
    chunks.push(Buffer.from(match[1], "hex").toString("latin1"));
  }
  return chunks.join("");
}

describe("lease evidence package PDF renderer", () => {
  it("keeps internal source reference tokens out of visible PDF text", async () => {
    const pdf = await renderLeaseEvidencePackagePdf(packageFixture());
    const text = decodedPdfText(pdf);

    expect(text).toContain("Evidence Package ID");
    expect(text).toContain("Lease ID");
    expect(text).toContain("Generated By");
    expect(text).toContain("Authorized User");
    expect(text).not.toContain("landlord-1");
    expect(text).toContain("Generated At");
    expect(text).toContain("Package Type");
    expect(text).toContain("Sections Included");
    expect(text).toContain("Verification Summary");
    expect(text).toContain("Manifest Version");
    expect(text).toContain("Hash Algorithm");
    expect(text).toContain("Manifest Hash");
    expect(text).toContain("Package Version");
    expect(text).toContain("lease_evidence_manifest_v1");
    expect(text).toContain("sha256");
    expect(text).toContain("lease-evidence-package-pdf-v1");
    expect(text).toContain("Lease record");
    expect(text).toContain("Message record");
    expect(text).toContain("Payment ledger entry");
    expect(text).toContain("Signing request");
    expect(text).toContain("Audit event");
    expect(text).not.toContain("Source References");

    for (const token of [
      "leases:",
      "messages:",
      "canonicalEvents:",
      "leaseSigningRequests:",
      "ledgerEntries:",
      "rentPayments:",
      "properties:",
      "tenants:",
    ]) {
      expect(text).not.toContain(token);
    }
  });
});
