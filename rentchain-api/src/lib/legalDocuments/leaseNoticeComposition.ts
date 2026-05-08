import type {
  LeaseNoticeRule,
  LeaseNoticeType,
  LeaseType,
  RentChangeMode,
} from "../../config/leaseNoticeRules";
import { legalExportMetadata, type LegalDocumentDefinition } from "./legalDocumentEngine";

export function composeLeaseNoticeLegalDocument(input: {
  leaseId: string;
  landlordId: string;
  tenantId: string;
  propertyId: string | null;
  unitId: string | null;
  province: string;
  leaseType: LeaseType;
  noticeType: LeaseNoticeType;
  rule: LeaseNoticeRule;
  rentChangeMode: RentChangeMode;
  currency: string;
  currentRent: number | null;
  proposedRent: number | null;
  newTermType: LeaseType;
  newTermStartDate: string;
  newTermEndDate: string | null;
  responseDeadlineAt: number;
  noticeDueAt: number | null;
}): LegalDocumentDefinition {
  const body =
    input.rentChangeMode === "undecided"
      ? "Rent will be decided later by the landlord."
      : input.proposedRent != null
      ? `Proposed rent: ${input.proposedRent} ${input.currency}`
      : "No rent change provided.";

  return {
    metadata: legalExportMetadata({
      documentKind: "lease_notice",
      title: "Lease notice preview",
      version: input.rule.ruleVersion,
      province: input.province,
      templateKey: input.rule.templateKey,
      sensitivity: "restricted",
    }),
    heading: {
      title: "Lease notice preview",
      description: body,
    },
    sections: [
      {
        id: "notice-context",
        title: "Notice context",
        fields: [
          { key: "leaseId", label: "Lease ID", value: input.leaseId },
          { key: "noticeType", label: "Notice type", value: input.noticeType },
          { key: "province", label: "Province", value: input.province },
          { key: "leaseType", label: "Lease type", value: input.leaseType },
          { key: "legalTemplateKey", label: "Legal template key", value: input.rule.templateKey },
          { key: "noticeRuleVersion", label: "Notice rule version", value: input.rule.ruleVersion },
        ],
        layout: { avoidBreakInside: true },
      },
      {
        id: "term-response",
        title: "Term and response",
        fields: [
          { key: "rentChangeMode", label: "Rent change mode", value: input.rentChangeMode },
          {
            key: "currentRent",
            label: "Current rent",
            value: input.currentRent == null ? "Not specified" : String(input.currentRent),
          },
          {
            key: "proposedRent",
            label: "Proposed rent",
            value: input.proposedRent == null ? "Not specified" : String(input.proposedRent),
          },
          { key: "newTermType", label: "New term type", value: input.newTermType },
          { key: "newTermStartDate", label: "New term start date", value: input.newTermStartDate },
          { key: "newTermEndDate", label: "New term end date", value: input.newTermEndDate || "Not specified" },
          { key: "responseDeadlineAt", label: "Response deadline", value: String(input.responseDeadlineAt) },
        ],
        body,
        layout: { avoidBreakInside: true },
      },
    ],
  };
}
