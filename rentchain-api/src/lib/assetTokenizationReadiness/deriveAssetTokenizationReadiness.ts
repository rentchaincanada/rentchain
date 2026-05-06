import type {
  AssetTokenizationAssetType,
  AssetTokenizationCanonicalEvent,
  AssetTokenizationReadiness,
  AssetTokenizationReadinessStatus,
  AssetTokenizationReference,
  DeriveAssetTokenizationReadinessInput,
} from "./assetTokenizationReadinessTypes";
import { assetReference, assetTokenizationIdPart } from "./assetEligibilityModels";

const REDACTIONS = [
  "Token issuance payloads are excluded.",
  "Blockchain addresses, wallets, and custody metadata are excluded.",
  "Investor data and securities-offering materials are excluded.",
  "Raw financial account data and unrestricted financial exports are excluded.",
  "Sensitive tenant, screening, and private audit payloads are excluded.",
];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function generatedAt(value: unknown): string {
  const raw = asString(value, 120);
  const date = raw ? new Date(raw) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function normalizeAssetType(value: unknown): AssetTokenizationAssetType {
  const raw = asString(value, 80);
  if (raw === "lease_cashflow" || raw === "operational_asset") return raw;
  return "property";
}

function idMatches(record: Record<string, unknown>, ids: string[], keys: string[]) {
  const safeIds = ids.map((id) => asString(id, 500)).filter(Boolean);
  if (!safeIds.length) return false;
  return keys.some((key) => safeIds.includes(asString(record[key], 500)));
}

function event(input: {
  eventType: AssetTokenizationCanonicalEvent["eventType"];
  status: AssetTokenizationReadinessStatus;
  assetReadinessId: string;
  summary: string;
}): AssetTokenizationCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^asset_tokenization_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "asset_tokenization_readiness",
    resourceId: input.assetReadinessId,
    summary: input.summary,
  };
}

function readinessStatus(hasContext: boolean, references: AssetTokenizationReference[]): AssetTokenizationReadinessStatus {
  if (!hasContext) return "unknown";
  if (references.some((reference) => reference.status === "blocked")) return "blocked";
  if (references.some((reference) => reference.status === "partially_verified" || reference.status === "unavailable")) return "partially_ready";
  return "eligible_for_review";
}

export function deriveAssetTokenizationReadiness(input: DeriveAssetTokenizationReadinessInput): AssetTokenizationReadiness {
  const landlordId = asString(input.landlordId, 240);
  const propertyId = asString(input.propertyId, 240);
  const assetType = normalizeAssetType(input.assetType);
  const assetReadinessId =
    assetTokenizationIdPart(["asset_tokenization_readiness", landlordId || "unknown", assetType, propertyId || "portfolio"].join(":")) ||
    "asset_tokenization_readiness:unknown";
  const properties = asArray(input.properties);
  const leases = asArray(input.leases);
  const obligationRows = asArray(input.obligationRows);
  const maintenanceRequests = asArray(input.maintenanceRequests);
  const evidencePacks = asArray(input.evidencePacks);
  const reviews = asArray(input.operatorReviewSessions);
  const auditEvents = asArray(input.auditEvents);
  const settlementReadiness = input.settlementReadiness || null;
  const regulatoryProfiles = asArray(input.regulatoryProfiles);

  const assetReferences = properties.length
    ? properties.map((property, index) => {
        const id = asString(property.propertyId || property.id || property.pid || index, 240);
        const status = id ? "verified" : "unavailable";
        return assetReference({
          idParts: ["property_identity", id || index],
          referenceType: "property_identity",
          status,
          label: "Canonical asset reference",
          description: "Property identity metadata is available as a canonical operational asset reference.",
          sourceId: id,
          destination: id ? `/properties?propertyId=${encodeURIComponent(id)}` : null,
        });
      })
    : [
        assetReference({
          idParts: ["property_identity", "missing"],
          referenceType: "property_identity",
          status: "unavailable",
          label: "Canonical asset reference",
          description: "No landlord-scoped property identity reference was available.",
          blockedReason: null,
        }),
      ];

  const cashflowReferences = obligationRows.length
    ? obligationRows.map((row) => {
        const rowId = asString(row.rowId || row.leaseId || "unknown", 240);
        const status = ["paid", "expected", "pending"].includes(asString(row.obligationStatus, 80)) ? "partially_verified" : "blocked";
        return assetReference({
          idParts: ["lease_cashflow", rowId],
          referenceType: "lease_cashflow",
          status,
          label: "Lease cashflow reference",
          description: "Lease cashflow is available as summarized obligation ledger metadata.",
          sourceId: rowId,
          destination: row.leaseId ? `/leases/${encodeURIComponent(asString(row.leaseId, 240))}/ledger` : null,
          blockedReason: status === "blocked" ? "Lease cashflow requires manual review before tokenization-readiness review." : null,
        });
      })
    : [
        assetReference({
          idParts: ["lease_cashflow", "missing"],
          referenceType: "lease_cashflow",
          status: "unavailable",
          label: "Lease cashflow reference",
          description: "Lease cashflow lineage is unavailable.",
        }),
      ];

  const occupancyReferences = leases.length
    ? leases.map((lease) => {
        const leaseId = asString(lease.leaseId || lease.id, 240);
        const hasOccupancyDates = Boolean(asString(lease.startDate, 120) || asString(lease.endDate, 120));
        return assetReference({
          idParts: ["occupancy", leaseId || "unknown"],
          referenceType: "occupancy",
          status: hasOccupancyDates ? "partially_verified" : "unavailable",
          label: "Occupancy reference",
          description: "Lease participation and occupancy timing are available as summary metadata.",
          sourceId: leaseId,
          destination: leaseId ? `/leases/${encodeURIComponent(leaseId)}` : null,
          blockedReason: null,
        });
      })
    : [];

  const maintenancePerformanceReferences = maintenanceRequests.map((request) => {
    const maintenanceId = asString(request.maintenanceRequestId || request.id, 240);
    return assetReference({
      idParts: ["maintenance_performance", maintenanceId || "unknown"],
      referenceType: "maintenance_performance",
      status: maintenanceId ? "partially_verified" : "unavailable",
      label: "Maintenance/performance reference",
      description: "Maintenance participation metadata is available as operational performance lineage.",
      sourceId: maintenanceId,
      destination: "/maintenance",
    });
  });

  const settlementReadinessReferences = settlementReadiness
    ? [
        assetReference({
          idParts: ["settlement_readiness", settlementReadiness.settlementReadinessId],
          referenceType: "settlement_readiness",
          status:
            settlementReadiness.status === "ready_for_review"
              ? "verified"
              : settlementReadiness.status === "blocked"
                ? "blocked"
                : "partially_verified",
          label: "Settlement readiness linkage",
          description: "Settlement readiness metadata is available for asset-tokenization readiness review.",
          sourceId: settlementReadiness.settlementReadinessId,
          destination: "/settlement-readiness",
          blockedReason: settlementReadiness.status === "blocked" ? "Settlement readiness is blocked." : null,
        }),
      ]
    : [
        assetReference({
          idParts: ["settlement_readiness", "missing"],
          referenceType: "settlement_readiness",
          status: "blocked",
          label: "Settlement readiness linkage",
          description: "Settlement readiness is required before asset-tokenization readiness review.",
          destination: "/settlement-readiness",
          blockedReason: "Settlement readiness lineage is missing.",
        }),
      ];

  const regulatoryProfileReferences = regulatoryProfiles.length
    ? regulatoryProfiles.map((profile) =>
        assetReference({
          idParts: ["regulatory_profile", profile.regulatoryProfileId],
          referenceType: "regulatory_profile",
          status: profile.status === "ready_for_review" ? "verified" : profile.status === "blocked" ? "blocked" : "partially_verified",
          label: "Regulatory profile linkage",
          description: "Regulatory profile metadata is available for asset-tokenization readiness review.",
          sourceId: profile.regulatoryProfileId,
          destination: "/regulatory-profiles",
          blockedReason: profile.status === "blocked" ? "Regulatory profile readiness is blocked." : null,
        })
      )
    : [
        assetReference({
          idParts: ["regulatory_profile", "missing"],
          referenceType: "regulatory_profile",
          status: "blocked",
          label: "Regulatory profile linkage",
          description: "Regulatory profile lineage is required before asset-tokenization readiness review.",
          destination: "/regulatory-profiles",
          blockedReason: "Regulatory profile lineage is missing.",
        }),
      ];

  const reviewReferences = reviews.map((review) => {
    const reviewId = asString(review.reviewSessionId || review.id, 240);
    return assetReference({
      idParts: ["review_lineage", reviewId || "unknown"],
      referenceType: "review_lineage",
      status: review.status === "completed" ? "verified" : "partially_verified",
      label: "Review lineage",
      description: "Operator review lineage is available for manual tokenization-readiness review.",
      sourceId: reviewId,
      destination: "/review-timeline",
    });
  });

  const evidenceReferences = evidencePacks.map((pack) => {
    const evidenceId = asString(pack.evidencePackId || pack.id, 240);
    return assetReference({
      idParts: ["evidence_lineage", evidenceId || "unknown"],
      referenceType: "evidence_lineage",
      status: pack.status === "blocked" ? "blocked" : "verified",
      label: "Evidence lineage",
      description: "Evidence pack lineage is available for asset-tokenization readiness review.",
      sourceId: evidenceId,
      destination: "/evidence-packs",
      blockedReason: pack.status === "blocked" ? "Evidence pack is blocked." : null,
    });
  });

  const unresolvedDelinquency = auditEvents.some((record) => {
    const text = `${asString(record.type || record.eventType || record.action, 200)} ${asString(record.status, 80)}`.toLowerCase();
    return text.includes("delinquency") && !text.includes("resolved") && !text.includes("closed");
  });
  const delinquencyReference = unresolvedDelinquency
    ? [
        assetReference({
          idParts: ["review_lineage", "unresolved_delinquency"],
          referenceType: "review_lineage",
          status: "blocked",
          label: "Delinquency review restriction",
          description: "Unresolved delinquency review metadata is visible as a tokenization-readiness restriction.",
          destination: "/review-timeline",
          blockedReason: "Unresolved delinquency review requires manual review before tokenization-readiness review.",
        }),
      ]
    : [];

  const allReferences = [
    ...assetReferences,
    ...cashflowReferences,
    ...occupancyReferences,
    ...maintenancePerformanceReferences,
    ...settlementReadinessReferences,
    ...regulatoryProfileReferences,
    ...reviewReferences,
    ...evidenceReferences,
    ...delinquencyReference,
  ];
  const hasContext = Boolean(landlordId && (properties.length || leases.length || obligationRows.length || settlementReadiness || regulatoryProfiles.length));
  const status = readinessStatus(hasContext, allReferences);
  const blockedReasons = allReferences.map((reference) => reference.blockedReason).filter(Boolean) as string[];

  return {
    assetReadinessId,
    assetType,
    status,
    manualReviewRequired: true,
    tokenIssuanceEnabled: false,
    blockchainIntegrationEnabled: false,
    publicMarketplaceEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalReferences: allReferences.length,
      verifiedReferences: allReferences.filter((reference) => reference.status === "verified").length,
      partiallyVerifiedReferences: allReferences.filter((reference) => reference.status === "partially_verified").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
      unavailableReferences: allReferences.filter((reference) => reference.status === "unavailable").length,
      tokenizationEligibleReferences: 0,
    },
    assetReferences,
    cashflowReferences,
    occupancyReferences,
    maintenancePerformanceReferences,
    settlementReadinessReferences,
    regulatoryProfileReferences,
    reviewReferences: [...reviewReferences, ...delinquencyReference],
    evidenceReferences,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents: [
      event({
        eventType: "asset_tokenization_readiness_derived",
        status,
        assetReadinessId,
        summary: "Asset tokenization readiness was derived from asset, cashflow, settlement, regulatory, review, and evidence metadata.",
      }),
      ...(status === "blocked"
        ? [
            event({
              eventType: "asset_tokenization_blocked",
              status,
              assetReadinessId,
              summary: "Asset tokenization readiness is blocked by missing or unsafe required lineage.",
            }),
          ]
        : []),
      ...(status === "partially_ready"
        ? [
            event({
              eventType: "asset_tokenization_review_required",
              status,
              assetReadinessId,
              summary: "Manual asset tokenization readiness review is required.",
            }),
          ]
        : []),
      ...(blockedReasons.length
        ? [
            event({
              eventType: "asset_tokenization_restriction_detected",
              status,
              assetReadinessId,
              summary: "Asset-tokenization restrictions were detected for manual review.",
            }),
          ]
        : []),
      event({
        eventType: "asset_tokenization_redaction_applied",
        status,
        assetReadinessId,
        summary: "Token, blockchain, investor, financial-account, tenant, screening, and private audit payloads were excluded.",
      }),
    ],
  };
}
