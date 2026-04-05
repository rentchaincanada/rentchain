import {
  addressMissing,
  buildBaseSubmissionPrefill,
  pushMissing,
} from "./registrySchemaCommon";
import type {
  RegistryFieldMapEntry,
  RegistrySchemaDefinition,
  RegistrySubmissionValidation,
  RegistryValidationItem,
} from "./registrySchemaTypes";

export const HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY = "halifax_rental_registry_form" as const;

export const HALIFAX_FIELD_MAP: RegistryFieldMapEntry[] = [
  {
    path: "fieldValues.siteAddress.line1",
    label: "Civic address",
    section: "Property / Site",
    required: true,
    source: "property",
    confidence: "high",
  },
  {
    path: "fieldValues.siteAddress.city",
    label: "City / Town",
    section: "Property / Site",
    required: true,
    source: "property",
    confidence: "high",
  },
  {
    path: "fieldValues.siteAddress.postalCode",
    label: "Postal code",
    section: "Property / Site",
    required: true,
    source: "property",
    confidence: "high",
  },
  {
    path: "fieldValues.propertyIdentifierPid",
    label: "Property PID",
    section: "Property / Site",
    required: false,
    source: "property",
    confidence: "high",
    notes: "Helpful for registry matching but not required for Halifax submission.",
  },
  {
    path: "fieldValues.owner.name",
    label: "Owner contact name",
    section: "Property Owner",
    required: true,
    source: "landlord_profile",
    confidence: "medium",
  },
  {
    path: "fieldValues.owner.company",
    label: "Owner company",
    section: "Property Owner",
    required: false,
    source: "landlord_profile",
    confidence: "medium",
  },
  {
    path: "fieldValues.owner.email",
    label: "Owner email",
    section: "Property Owner",
    required: true,
    source: "landlord_profile",
    confidence: "high",
  },
  {
    path: "fieldValues.owner.phone",
    label: "Owner phone",
    section: "Property Owner",
    required: true,
    source: "landlord_profile",
    confidence: "low",
  },
  {
    path: "fieldValues.owner.address",
    label: "Owner mailing address",
    section: "Property Owner",
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
    path: "fieldValues.primaryContact",
    label: "Primary contact details",
    section: "Primary Contact",
    required: true,
    source: "user_input_required",
    confidence: "low",
    notes: "Required when the primary contact is different from the owner.",
  },
  {
    path: "fieldValues.moreThanFiveBuildings",
    label: "More than 5 buildings on same property",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].primaryAddress",
    label: "Building civic address",
    section: "Buildings",
    required: true,
    source: "derived",
    confidence: "medium",
  },
  {
    path: "fieldValues.buildings[].rentalUnitTypes",
    label: "Rental unit types",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].residentialUnitsRented",
    label: "Residential units rented",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].shortTermRentalUnits",
    label: "Short-term rental units",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].buildingType",
    label: "Building type",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].totalResidentialUnits",
    label: "Total residential units in building",
    section: "Buildings",
    required: true,
    source: "derived",
    confidence: "medium",
  },
  {
    path: "fieldValues.buildings[].hasCommercialUnits",
    label: "Commercial units present",
    section: "Buildings",
    required: true,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].amenities",
    label: "Amenities / shared spaces",
    section: "Building Attributes",
    required: false,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].fireLifeSafetySystems",
    label: "Fire / life-safety systems",
    section: "Building Attributes",
    required: false,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.buildings[].yearConstructed",
    label: "Year constructed",
    section: "Building Attributes",
    required: false,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "fieldValues.propertyDescription",
    label: "Notes / property description",
    section: "Building Attributes",
    required: false,
    source: "user_input_required",
    confidence: "low",
  },
  {
    path: "declarations.acknowledged",
    label: "Declaration acknowledged",
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
    label: "Owner declaration confirmed",
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

export function validateHalifaxRegistrySubmission(input: Parameters<RegistrySchemaDefinition["validate"]>[0]): RegistrySubmissionValidation {
  const { fieldValues, declarations, consent } = input;
  const missingRequiredFields: RegistryValidationItem[] = [];
  const missingConsentItems: RegistryValidationItem[] = [];

  pushMissing(
    missingRequiredFields,
    "fieldValues.siteAddress.line1",
    "Property civic address",
    "Property / Site",
    addressMissing(fieldValues.siteAddress)
  );
  pushMissing(missingRequiredFields, "fieldValues.owner.name", "Owner contact name", "Property Owner", !fieldValues.owner.name);
  pushMissing(missingRequiredFields, "fieldValues.owner.email", "Owner email", "Property Owner", !fieldValues.owner.email);
  pushMissing(missingRequiredFields, "fieldValues.owner.phone", "Owner phone", "Property Owner", !fieldValues.owner.phone);
  pushMissing(
    missingRequiredFields,
    "fieldValues.owner.address",
    "Owner mailing address",
    "Property Owner",
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

  pushMissing(
    missingRequiredFields,
    "fieldValues.moreThanFiveBuildings",
    "More than five buildings confirmation",
    "Buildings",
    fieldValues.moreThanFiveBuildings === null
  );
  pushMissing(missingRequiredFields, "fieldValues.buildings", "At least one building", "Buildings", !Array.isArray(fieldValues.buildings) || fieldValues.buildings.length === 0);

  (fieldValues.buildings || []).forEach((building, index) => {
    const prefix = `fieldValues.buildings[${index}]`;
    pushMissing(missingRequiredFields, `${prefix}.primaryAddress`, `Building ${index + 1} civic address`, "Buildings", addressMissing(building.primaryAddress));
    pushMissing(missingRequiredFields, `${prefix}.rentalUnitTypes`, `Building ${index + 1} rental unit types`, "Buildings", !Array.isArray(building.rentalUnitTypes) || building.rentalUnitTypes.length === 0);
    pushMissing(missingRequiredFields, `${prefix}.residentialUnitsRented`, `Building ${index + 1} residential units rented`, "Buildings", building.residentialUnitsRented == null);
    pushMissing(missingRequiredFields, `${prefix}.shortTermRentalUnits`, `Building ${index + 1} short-term rental units`, "Buildings", building.shortTermRentalUnits == null);
    pushMissing(missingRequiredFields, `${prefix}.buildingType`, `Building ${index + 1} building type`, "Buildings", !building.buildingType);
    pushMissing(missingRequiredFields, `${prefix}.totalResidentialUnits`, `Building ${index + 1} total residential units`, "Buildings", building.totalResidentialUnits == null);
    pushMissing(missingRequiredFields, `${prefix}.hasCommercialUnits`, `Building ${index + 1} commercial unit presence`, "Buildings", building.hasCommercialUnits === null);
  });

  pushMissing(missingConsentItems, "consent.preparationAuthorized", "Preparation consent authorization", "Consent & Use Notice", !consent.preparationAuthorized);
  pushMissing(missingRequiredFields, "declarations.acknowledged", "Declaration acknowledgement", "Declarations", !declarations.acknowledged);
  pushMissing(missingRequiredFields, "declarations.maintenancePlanConfirmed", "Maintenance plan acknowledgement", "Declarations", !declarations.maintenancePlanConfirmed);
  pushMissing(missingRequiredFields, "declarations.ownerDeclarationConfirmed", "Owner declaration confirmation", "Declarations", !declarations.ownerDeclarationConfirmed);
  pushMissing(missingRequiredFields, "declarations.informationAccurateConfirmed", "Information accuracy confirmation", "Declarations", !declarations.informationAccurateConfirmed);
  pushMissing(missingConsentItems, "consent.declarationsConfirmed", "Declaration confirmation", "Declarations", !consent.declarationsConfirmed);

  const warnings: string[] = [];
  if (fieldValues.moreThanFiveBuildings === true) {
    warnings.push("Halifax form v1 supports up to five buildings per property. Municipal follow-up may be required.");
  }

  (fieldValues.buildings || []).forEach((building, index) => {
    if (!building.fireLifeSafetySystems.length) {
      warnings.push(`Building ${index + 1} has no fire / life-safety systems recorded yet.`);
    }
    if (!building.yearConstructed) {
      warnings.push(`Building ${index + 1} is missing year constructed.`);
    }
    if (!building.amenities.length) {
      warnings.push(`Building ${index + 1} has no amenity or shared-space details recorded.`);
    }
  });

  const trackedFields =
    8 + (fieldValues.primaryContactSameAsOwner === false ? 4 : 0) + (fieldValues.buildings || []).length * 6 + 6;
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

export const halifaxRentalRegistrySchema: RegistrySchemaDefinition = {
  schemaKey: "halifax_rental_registry_v1",
  sourceKey: HALIFAX_REGISTRY_SUBMISSION_SOURCE_KEY,
  label: "Halifax Rental Registry",
  mode: "official_registry",
  jurisdiction: {
    country: "CA",
    province: "NS",
    municipality: "Halifax",
  },
  fieldMap: HALIFAX_FIELD_MAP,
  buildPrefill: buildBaseSubmissionPrefill,
  validate: validateHalifaxRegistrySubmission,
};
