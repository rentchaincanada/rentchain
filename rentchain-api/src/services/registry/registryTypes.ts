export type RegistrySourceKey = "halifax_r400";

export type RegistrySourceRecord = {
  id: string;
  sourceKey: RegistrySourceKey;
  jurisdictionCountry: "CA";
  jurisdictionProvince: string;
  jurisdictionMunicipality: string;
  sourceType: "rental_registry";
  sourceLabel: string;
  sourceUrl: string | null;
  active: boolean;
  ingestionMode: "csv_upload";
  schemaVersion: number;
  refreshFrequency: "manual" | "weekly";
  latestImportId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RegistryImportStatus = "uploaded" | "processing" | "completed" | "failed";

export type RegistryImportRecord = {
  id: string;
  sourceKey: RegistrySourceKey;
  sourceFileName: string | null;
  sourceFileStoragePath: string | null;
  importBatchId: string;
  rowCount: number;
  parsedRowCount: number;
  normalizedRowCount: number;
  matchedRowCount: number;
  unmatchedRowCount: number;
  mismatchRowCount: number;
  ignoredRowCount: number;
  skippedRowCount: number;
  status: RegistryImportStatus;
  errorSummary: string | null;
  diagnostics: {
    missingPidCount: number;
    missingAddressCount: number;
    unsupportedStatusCount: number;
    invalidNumericFieldCount: number;
    duplicateRowHashCount: number;
  };
  startedAt: string;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type RegistryStatusNormalized = "registered" | "pending_review" | "not_registered" | "unknown";
export type RegistryMatchMethod = "pid_exact" | "address_exact" | "address_fuzzy" | "manual";
export type RegistryMatchStatus = "matched" | "possible_match" | "mismatch" | "unmatched" | "ignored";
export type PropertyRegistryStatusCode =
  | "verified"
  | "pending_review"
  | "not_found"
  | "possible_mismatch"
  | "manual_review";

export type RegistryRecordRaw = {
  id: string;
  importBatchId: string;
  sourceKey: RegistrySourceKey;
  sourceRowHash: string;
  sourcePayload: Record<string, unknown>;
  objectId: string | null;
  registrationNumber: string | null;
  pid: string | null;
  address: string | null;
  rentalUnitType: string | null;
  buildingType: string | null;
  registeredUnits: number | null;
  numberOfFloors: number | null;
  sharedFacilities: string | null;
  registered: string | null;
  dateRegistrationIssued: string | null;
  globalId: string | null;
  x: number | null;
  y: number | null;
  importedAt: string;
};

export type RegistryRecordNormalized = {
  id: string;
  importBatchId: string;
  sourceKey: RegistrySourceKey;
  jurisdictionCountry: "CA";
  jurisdictionProvince: string;
  jurisdictionMunicipality: string;
  registryCategory: "rental_registry";
  registryRecordId: string;
  registrationNumber: string | null;
  pid: string | null;
  addressRaw: string | null;
  addressNormalized: string | null;
  postalCode: string | null;
  rentalUnitTypeRaw: string | null;
  rentalUnitTypeNormalized: string | null;
  buildingTypeRaw: string | null;
  buildingTypeNormalized: string | null;
  registeredUnits: number | null;
  numberOfFloors: number | null;
  sharedFacilities: string | null;
  registrationStatusRaw: string | null;
  registrationStatusNormalized: RegistryStatusNormalized;
  registrationIssuedAt: string | null;
  lat: number | null;
  lng: number | null;
  sourceConfidence: number;
  importedAt: string;
  updatedAt: string;
};

export type RegistryMatchRecord = {
  id: string;
  sourceKey: RegistrySourceKey;
  registryRecordId: string;
  normalizedRecordId: string;
  propertyId: string | null;
  landlordId: string | null;
  matchMethod: RegistryMatchMethod | null;
  matchScore: number;
  matchStatus: RegistryMatchStatus;
  mismatchReasons: string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  overrideReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PropertyRegistryStatusRecord = {
  id: string;
  propertyId: string;
  sourceKey: RegistrySourceKey;
  jurisdictionProvince: string;
  jurisdictionMunicipality: string;
  registryStatus: PropertyRegistryStatusCode;
  registryRecordId: string | null;
  registrationNumber: string | null;
  matchedAt: string | null;
  matchConfidence: number | null;
  summary: string;
  recommendedAction: string;
  lastSourceRefreshAt: string | null;
  lastEvaluatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type RegistryAuditEventType =
  | "source_upserted"
  | "import_started"
  | "import_completed"
  | "import_failed"
  | "raw_row_written"
  | "normalized_row_written"
  | "match_evaluated"
  | "match_overridden"
  | "projection_updated";

export type RegistryAuditLogRecord = {
  id: string;
  sourceKey: RegistrySourceKey;
  importBatchId: string | null;
  registryRecordId: string | null;
  propertyId: string | null;
  actorType: "system" | "admin";
  actorId: string | null;
  eventType: RegistryAuditEventType;
  eventData: Record<string, unknown>;
  createdAt: string;
};

export type RegistryPropertyCandidate = {
  propertyId: string;
  landlordId: string | null;
  propertyName: string | null;
  addressLine1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  pid: string | null;
  unitCount: number | null;
  buildingType: string | null;
  addressNormalized: string | null;
};
