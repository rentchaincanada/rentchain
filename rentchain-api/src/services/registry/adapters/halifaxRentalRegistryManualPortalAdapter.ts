import { nowIso } from "../schemas/registrySchemaCommon";
import type {
  RegistryFilingAdapter,
  RegistrySubmissionReadyV3,
  RegistrySubmissionRequestV3,
} from "../registrySubmissionLayerTypes";
export const HALIFAX_MANUAL_PORTAL_ADAPTER_KEY = "halifax_rental_registry_manual_portal_v1";

export function buildHalifaxManualPortalChecklist(
  ready: RegistrySubmissionReadyV3
): RegistrySubmissionRequestV3["checklist"] {
  const propertySection = ready.normalizedSubmission.sections.find((section) => section.id === "property_site");
  const propertyAddress = propertySection?.fields.find((field) => field.id === "siteAddress")?.value;
  return {
    portalUrl: "https://www.halifax.ca/form/rental-registry",
    steps: [
      "Open Halifax's rental registry form in a browser.",
      "Review the prepared RentChain draft against the live Halifax form before entering any data.",
      "Copy the property, owner, building, and declaration details from the filing package into the Halifax form.",
      "Submit the Halifax form and retain any confirmation email, reference number, or screenshot.",
      "Record the filing reference and confirmation details back in RentChain.",
    ],
    notes: [
      `Prepared for ${ready.schemaLabel}.`,
      propertyAddress ? `Property address: ${String(propertyAddress)}` : "Property address is included in the prepared filing package.",
      "This adapter prepares a manual filing checklist only. It does not perform direct municipal submission.",
    ],
  };
}

export const halifaxRentalRegistryManualPortalAdapter: RegistryFilingAdapter = {
  adapterKey: HALIFAX_MANUAL_PORTAL_ADAPTER_KEY,
  schemaKey: "halifax_rental_registry_v1",
  filingChannel: "manual_portal",
  supportsAttachments: true,
  normalize(draft) {
    return {
      schemaVersion: 3,
      readyId: `${draft.draftId}__ready`,
      sourceDraftId: draft.draftId,
      sourceDraftVersion: draft.schemaVersion,
      propertyId: draft.context.propertyId,
      sourceKey: draft.context.sourceKey,
      schemaKey: draft.context.schemaKey,
      schemaLabel: draft.context.schemaLabel,
      assistantType: draft.assistantType,
      filingChannel: "manual_portal",
      status: draft.review.validation.exportReady ? "ready_to_file" : "in_review",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      actor: {
        landlordId: draft.actor.landlordId,
        updatedBy: draft.actor.updatedBy,
      },
      jurisdiction: draft.context.jurisdiction,
      validation: draft.review.validation,
      consentLock: draft.submission.consent,
      declarationsLock: draft.declarations,
      normalizedSubmission: {
        sections: [],
        attachments: draft.attachments,
        disclaimer: draft.meta.disclaimer,
      },
      audit: {
        sourceDraftUpdatedAt: draft.timestamps.updatedAt,
        events: [],
      },
    };
  },
  buildRequest(ready) {
    const now = nowIso();
    return {
      schemaVersion: 3,
      requestId: `${ready.sourceDraftId}__manual_portal`,
      attemptId: `${ready.sourceDraftId}__attempt_1`,
      readyId: ready.readyId,
      sourceDraftId: ready.sourceDraftId,
      propertyId: ready.propertyId,
      sourceKey: ready.sourceKey,
      schemaKey: ready.schemaKey,
      schemaLabel: ready.schemaLabel,
      filingChannel: "manual_portal",
      adapterKey: HALIFAX_MANUAL_PORTAL_ADAPTER_KEY,
      status: ready.status,
      createdAt: now,
      updatedAt: now,
      actor: {
        requestedBy: ready.actor.updatedBy,
        updatedBy: ready.actor.updatedBy,
      },
      checklist: buildHalifaxManualPortalChecklist(ready),
      payload: {
        sections: ready.normalizedSubmission.sections,
        disclaimer: ready.normalizedSubmission.disclaimer,
      },
      referenceNumbers: [],
      operatorNotes: null,
      evidence: [],
      audit: {
        events: [
          {
            at: now,
            actorId: ready.actor.updatedBy,
            type: "filing_request_created",
            status: ready.status,
            note: "Halifax manual portal filing request created.",
          },
        ],
      },
    };
  },
};
