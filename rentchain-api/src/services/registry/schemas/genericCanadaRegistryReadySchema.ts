import {
  addressMissing,
  buildBaseSubmissionPrefill,
  firstString,
  nowIso,
  pushMissing,
} from "./registrySchemaCommon";
import type {
  RegistryFieldMapEntry,
  RegistrySchemaDefinition,
  RegistrySubmissionValidation,
  RegistryValidationItem,
} from "./registrySchemaTypes";

export const GENERIC_CANADA_REGISTRY_READY_SOURCE_KEY = "canada_registry_ready_v1" as const;

export const GENERIC_CANADA_FIELD_MAP: RegistryFieldMapEntry[] = [
  {
    path: "fieldValues.siteAddress.line1",
    label: "Property civic address",
    section: "Property Identity",
    required: true,
    source: "property",
    confidence: "high",
  },
  {
    path: "fieldValues.propertyIdentifierPid",
    label: "Property identifier / PID",
    section: "Property Identity",
    required: false,
    source: "property",
    confidence: "high",
    notes: "Helpful for future registry matching and compliance readiness where available.",
  },
  {
    path: "fieldValues.owner.name",
    label: "Owner contact name",
    section: "Owner / Operator",
    required: true,
    source: "landlord_profile",
    confidence: "medium",
  },
  {
    path: "fieldValues.owner.email",
    label: "Owner email",
    section: "Owner / Operator",
    required: true,
    source: "landlord_profile",
    confidence: "high",
  },
  {
    path: "fieldValues.owner.phone",
    label: "Owner phone",
    section: "Owner / Operator",
    required: true,
    source: "landlord_profile",
    confidence: "medium",
  },
  {
    path: "fieldValues.owner.address",
    label: "Owner mailing address",
    section: "Owner / Operator",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.primaryContactSameAsOwner",
    label: "Primary contact same as owner",
    section: "Primary Contact",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].primaryAddress",
    label: "Building civic address",
    section: "Building Details",
    required: true,
    source: "derived",
    confidence: "medium",
  },
  {
    path: "fieldValues.buildings[].residentialUnitsRented",
    label: "Residential units rented",
    section: "Building Details",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].shortTermRentalUnits",
    label: "Short-term rental units",
    section: "Building Details",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].buildingType",
    label: "Building type",
    section: "Building Details",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].totalResidentialUnits",
    label: "Total residential units",
    section: "Building Details",
    required: true,
    source: "derived",
    confidence: "medium",
  },
  {
    path: "fieldValues.buildings[].fireLifeSafetySystems",
    label: "Fire / life-safety systems",
    section: "Compliance Readiness",
    required: false,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].yearConstructed",
    label: "Year constructed",
    section: "Compliance Readiness",
    required: false,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "declarations.acknowledged",
    label: "Readiness declaration acknowledged",
    section: "Declarations",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "declarations.maintenancePlanConfirmed",
    label: "Maintenance plan confirmed",
    section: "Declarations",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "declarations.ownerDeclarationConfirmed",
    label: "Owner / operator declaration confirmed",
    section: "Declarations",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "declarations.informationAccurateConfirmed",
    label: "Information accuracy confirmed",
    section: "Declarations",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
];

export function validateGenericCanadaRegistryReady(input: Parameters<RegistrySchemaDefinition["validate"]>[0]): RegistrySubmissionValidation {
  const { fieldValues, declarations, consent } = input;
  const missingRequiredFields: RegistryValidationItem[] = [];
  const missingConsentItems: RegistryValidationItem[] = [];

  pushMissing(
    missingRequiredFields,
    "fieldValues.siteAddress.line1",
    "Property civic address",
    "Property Identity",
    addressMissing(fieldValues.siteAddress)
  );
  pushMissing(missingRequiredFields, "fieldValues.owner.name", "Owner contact name", "Owner / Operator", !fieldValues.owner.name);
  pushMissing(missingRequiredFields, "fieldValues.owner.email", "Owner email", "Owner / Operator", !fieldValues.owner.email);
  pushMissing(missingRequiredFields, "fieldValues.owner.phone", "Owner phone", "Owner / Operator", !fieldValues.owner.phone);
  pushMissing(
    missingRequiredFields,
    "fieldValues.owner.address",
    "Owner mailing address",
    "Owner / Operator",
    addressMissing(fieldValues.owner.address, true)
  );
  pushMissing(
    missingRequiredFields,
    "fieldValues.primaryContactSameAsOwner",
    "Primary contact same as owner",
    "Primary Contact",
    fieldValues.primaryContactSameAsOwner === null
  );

  if (fieldValues.primaryContactSameAsOwner === false) {
    pushMissing(missingRequiredFields, "fieldValues.primaryContact.name", "Primary contact name", "Primary Contact", !fieldValues.primaryContact.name);
    pushMissing(missingRequiredFields, "fieldValues.primaryContact.email", "Primary contact email", "Primary Contact", !fieldValues.primaryContact.email);
    pushMissing(missingRequiredFields, "fieldValues.primaryContact.phone", "Primary contact phone", "Primary Contact", !fieldValues.primaryContact.phone);
    pushMissing(
      missingRequiredFields,
      "fieldValues.primaryContact.address",
      "Primary contact mailing address",
      "Primary Contact",
      addressMissing(fieldValues.primaryContact.address, true)
    );
  }

  pushMissing(missingRequiredFields, "fieldValues.buildings", "At least one building", "Building Details", !Array.isArray(fieldValues.buildings) || fieldValues.buildings.length === 0);

  (fieldValues.buildings || []).forEach((building, index) => {
    const prefix = `fieldValues.buildings[${index}]`;
    pushMissing(missingRequiredFields, `${prefix}.primaryAddress`, `Building ${index + 1} civic address`, "Building Details", addressMissing(building.primaryAddress));
    pushMissing(missingRequiredFields, `${prefix}.residentialUnitsRented`, `Building ${index + 1} residential units rented`, "Building Details", building.residentialUnitsRented == null);
    pushMissing(missingRequiredFields, `${prefix}.shortTermRentalUnits`, `Building ${index + 1} short-term rental units`, "Building Details", building.shortTermRentalUnits == null);
    pushMissing(missingRequiredFields, `${prefix}.buildingType`, `Building ${index + 1} building type`, "Building Details", !building.buildingType);
    pushMissing(missingRequiredFields, `${prefix}.totalResidentialUnits`, `Building ${index + 1} total residential units`, "Building Details", building.totalResidentialUnits == null);
  });

  pushMissing(missingConsentItems, "consent.preparationAuthorized", "Preparation consent authorization", "Consent & Use Notice", !consent.preparationAuthorized);
  pushMissing(missingRequiredFields, "declarations.acknowledged", "Readiness acknowledgement", "Declarations", !declarations.acknowledged);
  pushMissing(missingRequiredFields, "declarations.maintenancePlanConfirmed", "Maintenance plan acknowledgement", "Declarations", !declarations.maintenancePlanConfirmed);
  pushMissing(missingRequiredFields, "declarations.ownerDeclarationConfirmed", "Owner / operator declaration confirmation", "Declarations", !declarations.ownerDeclarationConfirmed);
  pushMissing(missingRequiredFields, "declarations.informationAccurateConfirmed", "Information accuracy confirmation", "Declarations", !declarations.informationAccurateConfirmed);
  pushMissing(missingConsentItems, "consent.declarationsConfirmed", "Declaration confirmation", "Declarations", !consent.declarationsConfirmed);

  const warnings: string[] = [];
  if (!fieldValues.propertyIdentifierPid) {
    warnings.push("No PID is recorded yet. Adding one can improve future registry and compliance readiness.");
  }
  if ((fieldValues.buildings || []).length > 5) {
    warnings.push("This draft includes more than five buildings. A future jurisdiction-specific schema may require additional grouping or municipal follow-up.");
  }
  (fieldValues.buildings || []).forEach((building, index) => {
    if (!building.fireLifeSafetySystems.length) {
      warnings.push(`Building ${index + 1} has no fire / life-safety systems recorded yet.`);
    }
    if (!building.yearConstructed) {
      warnings.push(`Building ${index + 1} is missing year constructed.`);
    }
  });

  const trackedFields = 7 + (fieldValues.primaryContactSameAsOwner === false ? 4 : 0) + (fieldValues.buildings || []).length * 4 + 6;
  const completedFields = Math.max(0, trackedFields - missingRequiredFields.length - missingConsentItems.length);
  const completionPercent = trackedFields > 0 ? Math.round((completedFields / trackedFields) * 100) : 0;
  const exportReady = missingRequiredFields.length === 0 && missingConsentItems.length === 0;
  const readinessScore = exportReady ? Math.max(85, completionPercent) : completionPercent;

  return {
    missingRequiredFields,
    missingConsentItems,
    warnings,
    readinessScore,
    completionPercent,
    exportReady,
  };
}

export const genericCanadaRegistryReadySchema: RegistrySchemaDefinition = {
  schemaKey: "canada_registry_ready_v1",
  sourceKey: GENERIC_CANADA_REGISTRY_READY_SOURCE_KEY,
  label: "Canada Registry-Ready Compliance Profile",
  mode: "registry_ready_fallback",
  jurisdiction: {
    country: "CA",
    province: null,
    municipality: null,
  },
  fieldMap: GENERIC_CANADA_FIELD_MAP,
  buildPrefill: buildBaseSubmissionPrefill,
  validate: validateGenericCanadaRegistryReady,
  buildExportPayload: ({ property, submission }) => ({
    schemaKey: "canada_registry_ready_v1",
    sourceKey: GENERIC_CANADA_REGISTRY_READY_SOURCE_KEY,
    generatedAt: nowIso(),
    disclaimer:
      "This file is a registry-ready preparation draft generated by RentChain from user-provided and stored property/account information. It is intended for review before any municipal or provincial use and does not indicate that an official registry currently exists or that any filing has occurred.",
    exportMeta: {
      preparedBy: "RentChain",
      preparedAt: nowIso(),
      propertyId: property?.id || submission.propertyId,
      sourceKey: GENERIC_CANADA_REGISTRY_READY_SOURCE_KEY,
      consentCapturedAt: submission.consent.preparationAuthorizedAt || null,
      declarationsConfirmedAt: submission.consent.declarationsConfirmedAt || null,
    },
    property: {
      propertyId: property?.id || submission.propertyId,
      propertyName: firstString(property?.name, property?.addressLine1) || "Property",
      propertyIdentifierPid: submission.fieldValues.propertyIdentifierPid,
    },
    jurisdiction: submission.jurisdiction,
    mode: "registry_ready_fallback",
    sections: {
      propertyIdentity: {
        civicAddress: submission.fieldValues.siteAddress,
        propertyIdentifierPid: submission.fieldValues.propertyIdentifierPid,
      },
      ownerOperator: submission.fieldValues.owner,
      primaryContact:
        submission.fieldValues.primaryContactSameAsOwner === false
          ? submission.fieldValues.primaryContact
          : {
              sameAsOwner: true,
              contact: submission.fieldValues.owner,
            },
      buildings: submission.fieldValues.buildings.map((building) => ({
        primaryAddress: building.primaryAddress,
        residentialUnitsRented: building.residentialUnitsRented,
        shortTermRentalUnits: building.shortTermRentalUnits,
        buildingType: building.buildingType,
        otherBuildingType: building.otherBuildingType,
        totalResidentialUnits: building.totalResidentialUnits,
        amenities: building.amenities,
        fireLifeSafetySystems: building.fireLifeSafetySystems,
        accessibilityFeatures: building.accessibilityFeatures,
        yearConstructed: building.yearConstructed,
        notes: building.notes,
      })),
      complianceReadiness: {
        propertyDescription: submission.fieldValues.propertyDescription,
      },
      declarations: submission.declarations,
    },
    consent: submission.consent,
    fieldMeta: submission.fieldMeta,
    validation: submission.validation,
  }),
};
